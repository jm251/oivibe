import { ok } from "@/lib/http";
import { clearSessionCredentials } from "@/lib/session/credentials";

export async function POST() {
  await clearSessionCredentials();
  return ok({ connected: false, mode: "mock" as const });
}