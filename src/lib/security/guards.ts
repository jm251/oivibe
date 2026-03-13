import "server-only";

import { NextResponse } from "next/server";

import { fail } from "@/lib/http";
import { hasAdminSession } from "@/lib/security/admin-session";

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
