import { fail, getSearchParam, ok } from "@/lib/http";
import { resolveOptionChainSnapshot, sanitizeSymbol } from "@/lib/market/service";

export async function GET(req: Request) {
  const symbol = sanitizeSymbol(getSearchParam(req, "symbol"));
  const expiry = getSearchParam(req, "expiry");

  try {
    const snapshot = await resolveOptionChainSnapshot(symbol, expiry ?? undefined);

    return ok({
      mode: snapshot.mode,
      symbol: snapshot.symbol,
      expiry: snapshot.expiry,
      spot: snapshot.spot,
      rows: snapshot.rows,
      aggregates: snapshot.aggregates,
      updatedAt: snapshot.updatedAt
    });
  } catch (error) {
    return fail(500, {
      code: "OPTION_CHAIN_FAILED",
      message: error instanceof Error ? error.message : "Unable to fetch option chain"
    });
  }
}