import "server-only";

import { env } from "@/lib/env";
import { NextResponse } from "next/server";

import { fail } from "@/lib/http";
import { hasAdminSession } from "@/lib/security/admin-session";
import { secureSecretEquals } from "@/lib/security/secret-compare";

export async function requireAdminApiAccess() {
  if (await hasAdminSession()) {
    return null;
  }

  return fail(401, {
    code: "ADMIN_UNLOCK_REQUIRED",
    message: "Operator unlock is required for this action."
  });
}

export async function requireAdminPageAccess() {
  if (await hasAdminSession()) {
    return null;
  }

  return NextResponse.json(
    {
      code: "ADMIN_UNLOCK_REQUIRED",
      message: "Operator unlock is required for this action."
    },
    { status: 403 }
  );
}

export function requireCronApiAccess(req: Request) {
  const configuredSecret = env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return fail(503, {
      code: "CRON_SECRET_MISSING",
      message: "Cron trigger secret is not configured."
    });
  }

  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const incomingSecret = match?.[1]?.trim() ?? "";

  if (!incomingSecret || !secureSecretEquals(incomingSecret, configuredSecret)) {
    return fail(401, {
      code: "CRON_UNAUTHORIZED",
      message: "Cron authorization is invalid."
    });
  }

  return null;
}
