import { z } from "zod";

import { fail, ok, parseJson } from "@/lib/http";
import {
  env,
  hasRuntimeTokenStoreConfig,
  hasUpstoxTokenRequestConfig
} from "@/lib/env";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { secureSecretEquals } from "@/lib/security/secret-compare";
import { writeRuntimeTokenRecord } from "@/lib/session/runtime-token-store";
import { validateAllowedUpstoxUser } from "@/lib/upstox/rest";

export const runtime = "nodejs";

const payloadSchema = z.object({
  client_id: z.string().min(1),
  user_id: z.string().min(1).optional(),
  access_token: z.string().min(20),
  token_type: z.string().optional(),
  issued_at: z.union([z.string(), z.number()]).optional(),
  expires_at: z.union([z.string(), z.number()]).optional(),
  message_type: z.string().optional()
});

function sanitize(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function toIsoDate(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numeric =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (Number.isFinite(numeric)) {
    return new Date(numeric).toISOString();
  }

  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ secret: string }> }
) {
  try {
    await assertRateLimit(req, "notifier");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return fail(429, {
        code: "RATE_LIMITED",
        message: error.message,
        resetAt: error.resetAt
      });
    }

    throw error;
  }

  const { secret } = await context.params;

  if (!secureSecretEquals(secret, env.UPSTOX_NOTIFIER_SECRET)) {
    return fail(401, {
      code: "UPSTOX_NOTIFIER_UNAUTHORIZED",
      message: "Notifier secret is invalid."
    });
  }

  if (!hasUpstoxTokenRequestConfig || !hasRuntimeTokenStoreConfig) {
    return fail(503, {
      code: "UPSTOX_NOTIFIER_UNAVAILABLE",
      message: "Runtime token notifier flow is not configured."
    });
  }

  try {
    const raw = await parseJson<unknown>(req);
    const payload = payloadSchema.parse(raw);

    if (payload.client_id !== sanitize(env.UPSTOX_API_KEY)) {
      return fail(400, {
        code: "UPSTOX_NOTIFIER_CLIENT_MISMATCH",
        message: "Notifier client_id does not match this app."
      });
    }

    const { userId } = await validateAllowedUpstoxUser({
      accessToken: payload.access_token
    });

    if (payload.user_id && sanitize(payload.user_id).toUpperCase() !== userId) {
      return fail(403, {
        code: "UPSTOX_NOTIFIER_USER_MISMATCH",
        message: "Notifier user_id does not match the validated operator account."
      });
    }

    await writeRuntimeTokenRecord({
      accessToken: payload.access_token,
      issuedAt: toIsoDate(payload.issued_at),
      expiresAt: toIsoDate(payload.expires_at),
      userId,
      tokenType: payload.token_type
    });

    return ok({
      stored: true
    });
  } catch (error) {
    return fail(400, {
      code: "UPSTOX_NOTIFIER_INVALID",
      message: error instanceof Error ? error.message : "Notifier payload is invalid"
    });
  }
}
