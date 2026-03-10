import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchUpstoxExpiries,
  fetchUpstoxOptionChainSnapshot
} from "@/lib/upstox/rest";

describe("upstox rest adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps contracts and option chain rows", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "success",
            data: [
              { expiry: "2026-03-17" },
              { expiry: "2026-03-10" }
            ]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "success",
            data: [
              { expiry: "2026-03-17" },
              { expiry: "2026-03-10" }
            ]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "success",
            data: [
              {
                expiry: "2026-03-10",
                strike_price: 24250,
                underlying_key: "NSE_INDEX|Nifty 50",
                underlying_spot_price: 24261.6,
                call_options: {
                  instrument_key: "NSE_FO|111",
                  market_data: {
                    ltp: 121.5,
                    volume: 1200,
                    oi: 8000,
                    prev_oi: 7600,
                    bid_price: 121,
                    ask_price: 122
                  },
                  option_greeks: {
                    delta: 0.4,
                    gamma: 0.02,
                    theta: -11,
                    vega: 8,
                    iv: 14.6
                  }
                },
                put_options: {
                  instrument_key: "NSE_FO|222",
                  market_data: {
                    ltp: 109.4,
                    volume: 980,
                    oi: 9100,
                    prev_oi: 9000,
                    bid_price: 109.1,
                    ask_price: 109.8
                  },
                  option_greeks: {
                    delta: -0.44,
                    gamma: 0.02,
                    theta: -10.4,
                    vega: 7.9,
                    iv: 13.2
                  }
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

    const expiries = await fetchUpstoxExpiries(
      { accessToken: "token-a" },
      "NIFTY"
    );
    expect(expiries).toEqual(["2026-03-10", "2026-03-17"]);

    const snapshot = await fetchUpstoxOptionChainSnapshot(
      { accessToken: "token-b" },
      "NIFTY",
      "2026-03-10"
    );

    expect(snapshot.expiry).toBe("2026-03-10");
    expect(snapshot.spot).toBe(24261.6);
    expect(snapshot.subscriptionKeys).toContain("NSE_INDEX|Nifty 50");
    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.rows[0]?.call.securityId).toBe("NSE_FO|111");
    expect(snapshot.rows[0]?.call.deltaOi).toBe(400);
    expect(snapshot.rows[0]?.put.greeks.delta).toBe(-0.44);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
