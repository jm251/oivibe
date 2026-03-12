import { z } from "zod";

import { fail, ok, parseJson } from "@/lib/http";
import { setSessionCredentials } from "@/lib/session/credentials";
import { writeRuntimeTokenRecord } from "@/lib/session/runtime-token-store";
import { validateUpstoxAccessToken } from "@/lib/upstox/rest";
import { computeUpstoxAccessTokenExpiry } from "@/lib/upstox/token-lifecycle";
import { hasRuntimeTokenStoreConfig } from "@/lib/env";

const payloadSchema = z.object({
  accessToken: z.string().min(20)
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const raw = await parseJson<unknown>(req);
    const payload = payloadSchema.parse(raw);

    try {
      await validateUpstoxAccessToken({ accessToken: payload.accessToken });
      const issuedAt = new Date().toISOString();
      const expiresAt = computeUpstoxAccessTokenExpiry(new Date(issuedAt));
      await setSessionCredentials({
        accessToken: payload.accessToken,
        issuedAt,
        expiresAt
      });
      if (hasRuntimeTokenStoreConfig) {
        await writeRuntimeTokenRecord({
          accessToken: payload.accessToken,
          issuedAt,
          expiresAt
        });
      }

      return ok({
        connected: true,
        mode: "live" as const
      });
    } catch {
      return ok({
        connected: false,
        mode: "mock" as const,
        message: "Upstox token rejected. Running in mock mode."
      });
    }
  } catch (error) {
    return fail(400, {
      code: "INVALID_CONNECT_PAYLOAD",
      message: error instanceof Error ? error.message : "Invalid request body"
    });
  }
}
