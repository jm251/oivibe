import { hasRuntimeTokenStoreConfig } from "@/lib/env";
import {
  deleteEdgeConfigItem,
  readEdgeConfigItem,
  upsertEdgeConfigItem
} from "@/lib/security/edge-config-store";

const EDGE_CONFIG_ITEM_KEY = "upstox_runtime_token";
const CACHE_TTL_MS = 15_000;

export interface RuntimeTokenRecord {
  accessToken: string;
  issuedAt?: string;
  expiresAt?: string;
  userId?: string;
  tokenType?: string;
  updatedAt: string;
}

let cachedRecord:
  | {
      record: RuntimeTokenRecord | null;
      ts: number;
    }
  | null = null;

function parseRuntimeTokenRecord(
  payload:
    | {
        updatedAt?: string;
        accessToken?: string;
        issuedAt?: string;
        expiresAt?: string;
        userId?: string;
        tokenType?: string;
      }
    | null
) {
  if (!payload?.accessToken) {
    return null;
  }

  return {
    accessToken: payload.accessToken,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    userId: payload.userId,
    tokenType: payload.tokenType,
    updatedAt: payload.updatedAt ?? new Date(0).toISOString()
  } satisfies RuntimeTokenRecord;
}

export async function readRuntimeTokenRecord(force = false) {
  if (!hasRuntimeTokenStoreConfig) {
    return null;
  }

  if (
    !force &&
    cachedRecord &&
    Date.now() - cachedRecord.ts < CACHE_TTL_MS
  ) {
    return cachedRecord.record;
  }

  const payload = await readEdgeConfigItem<{
    updatedAt?: string;
    accessToken?: string;
    issuedAt?: string;
    expiresAt?: string;
    userId?: string;
    tokenType?: string;
  }>(EDGE_CONFIG_ITEM_KEY);

  if (!payload) {
    cachedRecord = { record: null, ts: Date.now() };
    return null;
  }
  const record = parseRuntimeTokenRecord(payload);

  cachedRecord = {
    record,
    ts: Date.now()
  };

  return record;
}

export async function writeRuntimeTokenRecord(
  record: Omit<RuntimeTokenRecord, "updatedAt">
) {
  if (!hasRuntimeTokenStoreConfig) {
    throw new Error("Runtime token store is not configured");
  }

  const nextRecord: RuntimeTokenRecord = {
    ...record,
    updatedAt: new Date().toISOString()
  };

  await upsertEdgeConfigItem(EDGE_CONFIG_ITEM_KEY, nextRecord);

  cachedRecord = {
    record: nextRecord,
    ts: Date.now()
  };

  return nextRecord;
}

export async function clearRuntimeTokenRecord() {
  if (!hasRuntimeTokenStoreConfig) {
    return;
  }

  await deleteEdgeConfigItem(EDGE_CONFIG_ITEM_KEY);

  cachedRecord = {
    record: null,
    ts: Date.now()
  };
}
