import { fail, ok } from "@/lib/http";
import {
  env,
  hasRuntimeTokenStoreConfig,
  hasUpstoxTokenRequestConfig
} from "@/lib/env";
import { requestUpstoxAccessToken } from "@/lib/upstox/rest";

export const runtime = "nodejs";

function sanitize(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function toIsoDate(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const ts =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(ts)) {
    return undefined;
  }

  return new Date(ts).toISOString();
}

export async function POST(req: Request) {
  const expectedNotifierUrl = new URL(
    `/api/upstox/notifier/${sanitize(env.UPSTOX_NOTIFIER_SECRET)}`,
    req.url
  ).toString();

  if (!hasUpstoxTokenRequestConfig || !hasRuntimeTokenStoreConfig) {
    return fail(503, {
      code: "UPSTOX_TOKEN_REQUEST_UNAVAILABLE",
      message: "Runtime token request flow is not configured.",
      expectedNotifierUrl
    });
  }

  try {
    const payload = await requestUpstoxAccessToken();

    return ok({
      requested: true,
      authorizationExpiry: toIsoDate(payload.authorization_expiry),
      notifierUrl: payload.notifier_url ?? null,
      notifierMatchesApp:
        payload.notifier_url === expectedNotifierUrl,
      expectedNotifierUrl
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upstox token request failed";

    return fail(502, {
      code: "UPSTOX_TOKEN_REQUEST_FAILED",
      message,
      expectedNotifierUrl
    });
  }
}
