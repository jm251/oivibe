import { z } from "zod";

const supportedSymbolSchema = z.enum(["NIFTY", "BANKNIFTY", "FINNIFTY"]);
const optionSideSchema = z.enum(["CALL", "PUT"]);
const sourceModeSchema = z.enum(["live", "mock"]);
const sessionDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const greeksSchema = z.object({
  delta: z.number(),
  gamma: z.number(),
  theta: z.number(),
  vega: z.number()
});

const optionContractSchema = z.object({
  securityId: z.string().min(1),
  strike: z.number(),
  optionType: optionSideSchema,
  ltp: z.number(),
  oi: z.number(),
  previousOi: z.number(),
  deltaOi: z.number(),
  volume: z.number(),
  iv: z.number(),
  bid: z.number(),
  ask: z.number(),
  greeks: greeksSchema
});

const optionChainRowSchema = z.object({
  strike: z.number(),
  call: optionContractSchema,
  put: optionContractSchema
});

const oiWallSchema = z.object({
  strike: z.number(),
  oi: z.number(),
  deltaOi: z.number(),
  side: optionSideSchema
});

const chainAggregatesSchema = z.object({
  totalCallOi: z.number(),
  totalPutOi: z.number(),
  totalCallVolume: z.number(),
  totalPutVolume: z.number(),
  pcrOi: z.number(),
  pcrVolume: z.number(),
  topCallWalls: z.array(oiWallSchema),
  topPutWalls: z.array(oiWallSchema),
  strongestBuildup: oiWallSchema.nullable(),
  strongestUnwinding: oiWallSchema.nullable()
});

const replaySessionFrameSchema = z.object({
  symbol: supportedSymbolSchema,
  expiry: z.string().min(1),
  sessionDate: sessionDateSchema,
  sourceMode: sourceModeSchema,
  degraded: z.boolean(),
  message: z.string().optional(),
  updatedAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
  spot: z.number(),
  rows: z.array(optionChainRowSchema),
  aggregates: chainAggregatesSchema
});

export const replaySessionTransferSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    symbol: supportedSymbolSchema,
    expiry: z.string().min(1),
    sessionDate: sessionDateSchema,
    frames: z.array(replaySessionFrameSchema).min(1)
  })
  .superRefine((payload, ctx) => {
    for (const [index, frame] of payload.frames.entries()) {
      if (frame.symbol !== payload.symbol) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Frame ${index + 1} symbol does not match export symbol`
        });
      }

      if (frame.expiry !== payload.expiry) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Frame ${index + 1} expiry does not match export expiry`
        });
      }

      if (frame.sessionDate !== payload.sessionDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Frame ${index + 1} session does not match export session`
        });
      }
    }
  });

export type ReplaySessionTransfer = z.infer<typeof replaySessionTransferSchema>;
export type ReplaySessionTransferFrame = ReplaySessionTransfer["frames"][number];

export function buildReplaySessionTransfer(payload: ReplaySessionTransfer) {
  return replaySessionTransferSchema.parse(payload);
}

export function parseReplaySessionTransfer(raw: unknown) {
  return replaySessionTransferSchema.parse(raw);
}

export function buildReplaySessionFilename(payload: ReplaySessionTransfer) {
  return `oi-vibe-${payload.symbol.toLowerCase()}-${payload.expiry}-${payload.sessionDate}.json`;
}
