import { fail, getSearchParam, ok } from "@/lib/http";
import { resolveExpiries, sanitizeSymbol } from "@/lib/market/service";

export async function GET(req: Request) {
  const symbol = sanitizeSymbol(getSearchParam(req, "symbol"));

  try {
    const result = await resolveExpiries(symbol);
    return ok({ symbol, ...result });
  } catch (error) {
    return fail(500, {
      code: "EXPIRY_FETCH_FAILED",
      message: error instanceof Error ? error.message : "Unable to fetch expiries"
    });
  }
}