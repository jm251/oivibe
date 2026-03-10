import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { env, hasUpstoxOauthConfig } from "@/lib/env";

const OAUTH_STATE_COOKIE = "oi_vibe_upstox_oauth_state";
const OAUTH_RETURN_TO_COOKIE = "oi_vibe_upstox_oauth_return_to";
const OAUTH_COOKIE_MAX_AGE_SEC = 10 * 60;
const UPSTOX_DIALOG_URL = "https://api.upstox.com/v2/login/authorization/dialog";

function sanitize(input: string | undefined) {
  return input?.trim().replace(/^['\"]|['\"]$/g, "") ?? "";
}

function normalizeReturnTo(input: string | undefined) {
  if (!input || !input.startsWith("/") || input.startsWith("//")) {
    return "/";
  }
  return input;
}

function buildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE_SEC
  };
}

export function getUpstoxRedirectUri() {
  const redirectUri = sanitize(env.UPSTOX_REDIRECT_URI);
  if (!redirectUri) {
    throw new Error("UPSTOX_REDIRECT_URI is not configured");
  }
  return redirectUri;
}

export function buildUpstoxAuthorizationUrl(state: string) {
  if (!hasUpstoxOauthConfig) {
    throw new Error("Upstox OAuth is not configured");
  }

  const url = new URL(UPSTOX_DIALOG_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", sanitize(env.UPSTOX_API_KEY));
  url.searchParams.set("redirect_uri", getUpstoxRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

export async function beginUpstoxOauth(returnTo?: string) {
  const state = randomBytes(24).toString("base64url");
  const store = await cookies();

  store.set(OAUTH_STATE_COOKIE, state, buildCookieOptions());
  store.set(
    OAUTH_RETURN_TO_COOKIE,
    normalizeReturnTo(returnTo),
    buildCookieOptions()
  );

  return buildUpstoxAuthorizationUrl(state);
}

export async function consumeUpstoxOauthState(expectedState: string) {
  const store = await cookies();
  const actualState = store.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const returnTo = normalizeReturnTo(store.get(OAUTH_RETURN_TO_COOKIE)?.value);

  store.delete(OAUTH_STATE_COOKIE);
  store.delete(OAUTH_RETURN_TO_COOKIE);

  return {
    valid: Boolean(expectedState && actualState && expectedState === actualState),
    returnTo
  };
}
