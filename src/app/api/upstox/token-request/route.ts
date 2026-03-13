import { fail, ok } from "@/lib/http";
import {
  env,
  hasRuntimeTokenStoreConfig,
  hasUpstoxTokenRequestConfig
} from "@/lib/env";
import { requireAdminApiAccess } from "@/lib/security/guards";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
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
  const unauthorized = await requireAdminApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  if (!hasUpstoxTokenRequestConfig || !hasRuntimeTokenStoreConfig) {
    return fail(503, {
      code: "UPSTOX_TOKEN_REQUEST_UNAVAILABLE",
      message: "Runtime token request flow is not configured."
    });
  }

  try {
    await assertRateLimit(req, "token-request");
    const payload = await requestUpstoxAccessToken();
    const expectedNotifierUrl = new URL(
      `/api/upstox/notifier/${sanitize(env.UPSTOX_NOTIFIER_SECRET)}`,
      req.url
    ).toString();

    if (!payload.notifier_url) {
      return fail(502, {
        code: "UPSTOX_TOKEN_REQUEST_FAILED",
        message: "Upstox did not return a notifier URL."
      });
    }

    if (payload.notifier_url !== expectedNotifierUrl) {
      return fail(502, {
        code: "UPSTOX_TOKEN_REQUEST_FAILED",
        message: "Configured Upstox notifier URL does not match this deployment."
      });
    }

    return ok({
      requested: true,
      authorizationExpiry: toIsoDate(payload.authorization_expiry)
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return fail(429, {
        code: "RATE_LIMITED",
        message: error.message,
        resetAt: error.resetAt
      });
    }

    return fail(502, {
      code: "UPSTOX_TOKEN_REQUEST_FAILED",
      message: error instanceof Error ? error.message : "Upstox token request failed"
    });
  }
}
