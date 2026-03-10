export interface UpstoxCredentials {
  accessToken: string;
}

export interface UpstoxOptionContract {
  expiry: string;
  instrument_key: string;
  lot_size: number;
  instrument_type: "CE" | "PE" | string;
  underlying_key: string;
  underlying_symbol: string;
  strike_price: number;
}

export interface UpstoxMarketData {
  ltp?: number;
  volume?: number;
  oi?: number;
  close_price?: number;
  bid_price?: number;
  bid_qty?: number;
  ask_price?: number;
  ask_qty?: number;
  prev_oi?: number;
}

export interface UpstoxOptionGreeks {
  delta?: number;
  theta?: number;
  gamma?: number;
  vega?: number;
  iv?: number;
}

export interface UpstoxChainLeg {
  instrument_key?: string;
  market_data?: UpstoxMarketData;
  option_greeks?: UpstoxOptionGreeks;
}

export interface UpstoxChainEntry {
  expiry: string;
  strike_price: number;
  underlying_key: string;
  underlying_spot_price: number;
  call_options?: UpstoxChainLeg;
  put_options?: UpstoxChainLeg;
}

export interface UpstoxChainSnapshot {
  spot: number;
  expiry: string;
  rows: import("@/lib/types").OptionChainRow[];
  subscriptionKeys: string[];
  underlyingKey: string;
}

export interface UpstoxWsFeedUpdate {
  securityId: string;
  ltp: number;
  volume: number;
  oi: number;
  bid: number;
  ask: number;
  iv: number;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
}
