import { z } from "zod";

import { env } from "@/lib/env";
import { fail, ok, parseJson } from "@/lib/http";
import { setAdminSession } from "@/lib/security/admin-session";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { secureSecretEquals } from "@/lib/security/secret-compare";
import { resolveRuntimeStatus } from "@/lib/session/runtime";

const payloadSchema = z.object({
  secret: z.string().min(16)
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await assertRateLimit(req, "admin-unlock");
    const payload = payloadSchema.parse(await parseJson<unknown>(req));

    if (!secureSecretEquals(payload.secret, env.OI_VIBE_ADMIN_SECRET)) {
      return fail(401, {
        code: "ADMIN_UNLOCK_INVALID",
        message: "Operator secret is invalid."
      });
    }

    await setAdminSession();
    return ok(await resolveRuntimeStatus());
  } catch (error) {
    if (error instanceof RateLimitError) {
      return fail(429, {
        code: "RATE_LIMITED",
        message: error.message,
        resetAt: error.resetAt
      });
    }

    return fail(400, {
      code: "ADMIN_UNLOCK_INVALID_PAYLOAD",
      message: error instanceof Error ? error.message : "Invalid request body"
    });
  }
}
