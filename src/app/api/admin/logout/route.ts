import { ok } from "@/lib/http";
import { clearAdminSession } from "@/lib/security/admin-session";
import { resolveRuntimeStatus } from "@/lib/session/runtime";

export async function POST() {
  await clearAdminSession();
  return ok(await resolveRuntimeStatus());
}
