import { ok } from "@/lib/http";

export async function GET() {
  return ok({ status: "ok", service: "oi-vibe", ts: new Date().toISOString() });
}