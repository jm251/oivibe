export type SupportedSymbol = "NIFTY" | "BANKNIFTY" | "FINNIFTY";

export interface UnderlyingRef {
  symbol: SupportedSymbol;
  displayName: string;
  upstoxInstrumentKey: string;
  upstoxUnderlyingSymbol: string;
  lotSize: number;
  strikeStep: number;
}

export type OptionSide = "CALL" | "PUT";
export type TradeSide = "BUY" | "SELL";

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionContract {
  securityId: string;
  strike: number;
  optionType: OptionSide;
  ltp: number;
  oi: number;
  previousOi: number;
  deltaOi: number;
  volume: number;
  iv: number;
  bid: number;
  ask: number;
  greeks: Greeks;
}

export interface OptionChainRow {
  strike: number;
  call: OptionContract;
  put: OptionContract;
}

export interface OiWall {
  strike: number;
  oi: number;
  deltaOi: number;
  side: OptionSide;
}

export interface ChainAggregates {
  totalCallOi: number;
  totalPutOi: number;
  totalCallVolume: number;
  totalPutVolume: number;
  pcrOi: number;
  pcrVolume: number;
  topCallWalls: OiWall[];
  topPutWalls: OiWall[];
  strongestBuildup: OiWall | null;
  strongestUnwinding: OiWall | null;
}

export interface OptionChainSnapshot {
  mode: "live" | "mock";
  symbol: SupportedSymbol;
  expiry: string;
  spot: number;
  rows: OptionChainRow[];
  aggregates: ChainAggregates;
  updatedAt: string;
}

export interface TickDelta {
  securityId: string;
  ltp: number;
  volume: number;
  oi: number;
  deltaOi: number;
  bid?: number;
  ask?: number;
  iv?: number;
  greeks?: Partial<Greeks>;
}

export interface FeedSnapshotEvent {
  rows: OptionChainRow[];
  aggregates: ChainAggregates;
  spot: number;
  ts: string;
}

export interface FeedTickEvent {
  updates: TickDelta[];
  aggregates: ChainAggregates;
  spot: number;
  ts: string;
}

export interface OptionLeg {
  id: string;
  side: TradeSide;
  optionType: OptionSide;
  strike: number;
  premium: number;
  quantity: number;
  iv: number;
  daysToExpiry: number;
  lotSize: number;
  greeks?: Greeks;
}

export interface PayoffPoint {
  spot: number;
  pnl: number;
}

export interface StrategyGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface StrategySnapshot {
  payoffSeries: PayoffPoint[];
  breakEvens: number[];
  maxProfit: number;
  maxLoss: number;
  greeks: StrategyGreeks;
}

export interface ConnectionState {
  connected: boolean;
  mode: "live" | "mock";
  message?: string;
}

export interface VolSurfacePoint {
  strike: number;
  dte: number;
  iv: number;
}
