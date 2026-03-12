import { NextResponse } from "next/server";

import { hasRuntimeTokenStoreConfig } from "@/lib/env";
import { setSessionCredentials } from "@/lib/session/credentials";
import { writeRuntimeTokenRecord } from "@/lib/session/runtime-token-store";
import { consumeUpstoxOauthState } from "@/lib/upstox/oauth";
import {
  exchangeUpstoxAuthorizationCode,
  validateUpstoxAccessToken
} from "@/lib/upstox/rest";
import { computeUpstoxAccessTokenExpiry } from "@/lib/upstox/token-lifecycle";

export const runtime = "nodejs";

function redirectWithParams(req: Request, returnTo: string, params: Record<string, string>) {
  const url = new URL(returnTo, req.url);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const upstreamError = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const { valid, returnTo } = await consumeUpstoxOauthState(state);

  if (!valid) {
    return redirectWithParams(req, "/", {
      oauth: "error",
      reason: "state_mismatch"
    });
  }

  if (upstreamError) {
    return redirectWithParams(req, returnTo, {
      oauth: "error",
      reason: errorDescription || upstreamError
    });
  }

  if (!code) {
    return redirectWithParams(req, returnTo, {
      oauth: "error",
      reason: "missing_code"
    });
  }

  try {
    const accessToken = await exchangeUpstoxAuthorizationCode(code);
    await validateUpstoxAccessToken({ accessToken });
    const issuedAt = new Date().toISOString();
    const expiresAt = computeUpstoxAccessTokenExpiry(new Date(issuedAt));
    await setSessionCredentials({
      accessToken,
      issuedAt,
      expiresAt
    });
    if (hasRuntimeTokenStoreConfig) {
      await writeRuntimeTokenRecord({
        accessToken,
        issuedAt,
        expiresAt
      });
    }

    return redirectWithParams(req, returnTo, {
      oauth: "connected"
    });
  } catch (error) {
    return redirectWithParams(req, returnTo, {
      oauth: "error",
      reason: error instanceof Error ? error.message : "token_exchange_failed"
    });
  }
}
