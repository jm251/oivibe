import { ok } from "@/lib/http";
import { resolveRuntimeStatus } from "@/lib/session/runtime";

export async function GET() {
  return ok(await resolveRuntimeStatus());
}
