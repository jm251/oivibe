import { ok } from "@/lib/http";
import { resolveRuntimeCredentials } from "@/lib/session/runtime";

export async function GET() {
  const resolved = await resolveRuntimeCredentials();
  return ok({
    connected: Boolean(resolved.credentials),
    mode: resolved.credentials ? "live" : "mock",
    source: resolved.source
  });
}