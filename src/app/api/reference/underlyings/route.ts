import { ok } from "@/lib/http";
import { listUnderlyings } from "@/lib/market/service";

export async function GET() {
  return ok({ underlyings: listUnderlyings() });
}