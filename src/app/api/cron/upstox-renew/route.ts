import { fail, ok } from "@/lib/http";
import {
  hasRuntimeTokenStoreConfig,
  hasUpstoxTokenRequestConfig
} from "@/lib/env";
import { requireCronApiAccess } from "@/lib/security/guards";
import { requestUpstoxApproval } from "@/lib/upstox/token-request-flow";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const unauthorized = requireCronApiAccess(req);
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
    return ok({
      trigger: "cron",
      ...(await requestUpstoxApproval(req.url))
    });
  } catch (error) {
    return fail(502, {
      code: "UPSTOX_TOKEN_REQUEST_FAILED",
      message: error instanceof Error ? error.message : "Upstox token request failed"
    });
  }
}
