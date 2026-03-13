import { NextResponse } from "next/server";

import { hasRuntimeTokenStoreConfig } from "@/lib/env";
import { requireAdminPageAccess } from "@/lib/security/guards";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { setSessionCredentials } from "@/lib/session/credentials";
import { writeRuntimeTokenRecord } from "@/lib/session/runtime-token-store";
import { consumeUpstoxOauthState } from "@/lib/upstox/oauth";
import {
  exchangeUpstoxAuthorizationCode,
  validateAllowedUpstoxUser
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
  const unauthorized = await requireAdminPageAccess();
  if (unauthorized) {
    return unauthorized;
  }

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
    await assertRateLimit(req, "oauth-callback");
    const accessToken = await exchangeUpstoxAuthorizationCode(code);
    const { userId } = await validateAllowedUpstoxUser({ accessToken });
    const issuedAt = new Date().toISOString();
    const expiresAt = computeUpstoxAccessTokenExpiry(new Date(issuedAt));
    await setSessionCredentials({
      accessToken,
      issuedAt,
      expiresAt,
      userId
    });
    if (hasRuntimeTokenStoreConfig) {
      await writeRuntimeTokenRecord({
        accessToken,
        issuedAt,
        expiresAt,
        userId
      });
    }

    return redirectWithParams(req, returnTo, {
      oauth: "connected"
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          message: error.message,
          resetAt: error.resetAt
        },
        { status: 429 }
      );
    }

    return redirectWithParams(req, returnTo, {
      oauth: "error",
      reason: error instanceof Error ? error.message : "token_exchange_failed"
    });
  }
}
