import { NextResponse } from "next/server";

import { beginUpstoxOauth } from "@/lib/upstox/oauth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/";

  try {
    const authorizationUrl = await beginUpstoxOauth(returnTo);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const redirectUrl = new URL("/", url);
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set(
      "reason",
      error instanceof Error ? error.message : "OAuth configuration is invalid"
    );
    return NextResponse.redirect(redirectUrl);
  }
}
