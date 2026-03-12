import { ok } from "@/lib/http";
import { clearSessionCredentials } from "@/lib/session/credentials";
import { resolveRuntimeStatus } from "@/lib/session/runtime";

export async function POST() {
  await clearSessionCredentials();
  return ok(await resolveRuntimeStatus());
}
