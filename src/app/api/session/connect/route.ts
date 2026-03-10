import { z } from "zod";

import { fail, ok, parseJson } from "@/lib/http";
import { setSessionCredentials } from "@/lib/session/credentials";
import { validateUpstoxAccessToken } from "@/lib/upstox/rest";

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
      await setSessionCredentials({ accessToken: payload.accessToken });

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
