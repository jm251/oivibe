import { NextResponse } from "next/server";

import { requireAdminPageAccess } from "@/lib/security/guards";
import { assertRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { beginUpstoxOauth } from "@/lib/upstox/oauth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const unauthorized = await requireAdminPageAccess();
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/";

  try {
    await assertRateLimit(req, "oauth-login");
    const authorizationUrl = await beginUpstoxOauth(returnTo);
    return NextResponse.redirect(authorizationUrl);
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

    const redirectUrl = new URL("/", url);
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set(
      "reason",
      error instanceof Error ? error.message : "OAuth configuration is invalid"
    );
    return NextResponse.redirect(redirectUrl);
  }
}
