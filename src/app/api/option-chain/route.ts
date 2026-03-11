import { fail, getSearchParam, ok } from "@/lib/http";
import { resolveOptionChainSnapshot, sanitizeSymbol } from "@/lib/market/service";
import { isUpstoxTokenErrorMessage } from "@/lib/upstox/token-lifecycle";

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
      updatedAt: snapshot.updatedAt,
      degraded: snapshot.degraded,
      message: snapshot.message
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch option chain";

    if (isUpstoxTokenErrorMessage(message)) {
      return fail(401, {
        code: "UPSTOX_TOKEN_EXPIRED",
        message
      });
    }

    return fail(500, {
      code: "OPTION_CHAIN_FAILED",
      message
    });
  }
}
