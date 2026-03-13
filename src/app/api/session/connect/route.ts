import { z } from "zod";

import { hasRuntimeTokenStoreConfig } from "@/lib/env";
import { fail, ok, parseJson } from "@/lib/http";
import { requireAdminApiAccess } from "@/lib/security/guards";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { setSessionCredentials } from "@/lib/session/credentials";
import { writeRuntimeTokenRecord } from "@/lib/session/runtime-token-store";
import { validateAllowedUpstoxUser } from "@/lib/upstox/rest";
import { computeUpstoxAccessTokenExpiry } from "@/lib/upstox/token-lifecycle";

const payloadSchema = z.object({
  accessToken: z.string().min(20)
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const unauthorized = await requireAdminApiAccess();
    if (unauthorized) {
      return unauthorized;
    }

    await assertRateLimit(req, "session-connect");
    const raw = await parseJson<unknown>(req);
    const payload = payloadSchema.parse(raw);
    const { userId } = await validateAllowedUpstoxUser({
      accessToken: payload.accessToken
    });

    const issuedAt = new Date().toISOString();
    const expiresAt = computeUpstoxAccessTokenExpiry(new Date(issuedAt));

    await setSessionCredentials({
      accessToken: payload.accessToken,
      issuedAt,
      expiresAt,
      userId
    });

    if (hasRuntimeTokenStoreConfig) {
      await writeRuntimeTokenRecord({
        accessToken: payload.accessToken,
        issuedAt,
        expiresAt,
        userId
      });
    }

    return ok({
      connected: true,
      mode: "live" as const,
      adminUnlocked: true
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return fail(429, {
        code: "RATE_LIMITED",
        message: error.message,
        resetAt: error.resetAt
      });
    }

    return fail(400, {
      code: "INVALID_CONNECT_PAYLOAD",
      message: error instanceof Error ? error.message : "Unable to validate Upstox token"
    });
  }
}
