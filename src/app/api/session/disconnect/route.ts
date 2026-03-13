import { hasRuntimeTokenStoreConfig } from "@/lib/env";
import { ok } from "@/lib/http";
import { requireAdminApiAccess } from "@/lib/security/guards";
import { clearSessionCredentials } from "@/lib/session/credentials";
import { resolveRuntimeStatus } from "@/lib/session/runtime";
import { clearRuntimeTokenRecord } from "@/lib/session/runtime-token-store";

export async function POST() {
  const unauthorized = await requireAdminApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  await clearSessionCredentials();
  if (hasRuntimeTokenStoreConfig) {
    await clearRuntimeTokenRecord();
  }
  return ok(await resolveRuntimeStatus());
}
