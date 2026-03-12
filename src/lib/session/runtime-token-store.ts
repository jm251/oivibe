import { env, hasRuntimeTokenStoreConfig } from "@/lib/env";

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

function sanitize(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function buildEdgeConfigUrl() {
  const id = sanitize(env.UPSTOX_RUNTIME_EDGE_CONFIG_ID);
  const teamId = sanitize(env.UPSTOX_RUNTIME_VERCEL_TEAM_ID);
  const url = new URL(
    `https://api.vercel.com/v1/edge-config/${id}/items/${EDGE_CONFIG_ITEM_KEY}`
  );

  if (teamId) {
    url.searchParams.set("teamId", teamId);
  }

  return url;
}

function buildEdgeConfigMutationUrl() {
  const id = sanitize(env.UPSTOX_RUNTIME_EDGE_CONFIG_ID);
  const teamId = sanitize(env.UPSTOX_RUNTIME_VERCEL_TEAM_ID);
  const url = new URL(`https://api.vercel.com/v1/edge-config/${id}/items`);

  if (teamId) {
    url.searchParams.set("teamId", teamId);
  }

  return url;
}

function buildHeaders() {
  return {
    Authorization: `Bearer ${sanitize(env.UPSTOX_RUNTIME_VERCEL_API_TOKEN)}`,
    "Content-Type": "application/json"
  };
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

  const response = await fetch(buildEdgeConfigUrl(), {
    headers: buildHeaders(),
    cache: "no-store"
  });

  if (response.status === 404) {
    cachedRecord = { record: null, ts: Date.now() };
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Runtime token read failed (${response.status}): ${text || "Unknown error"}`
    );
  }

  const payload = (await response.json()) as {
    value?: RuntimeTokenRecord | null;
    item?: {
      value?: RuntimeTokenRecord | null;
    };
  };
  const record =
    payload.value ??
    payload.item?.value ??
    null;

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

  const response = await fetch(buildEdgeConfigMutationUrl(), {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify({
      items: [
        {
          operation: "upsert",
          key: EDGE_CONFIG_ITEM_KEY,
          value: nextRecord
        }
      ]
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Runtime token write failed (${response.status}): ${text || "Unknown error"}`
    );
  }

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

  const response = await fetch(buildEdgeConfigMutationUrl(), {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify({
      items: [
        {
          operation: "delete",
          key: EDGE_CONFIG_ITEM_KEY
        }
      ]
    }),
    cache: "no-store"
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(
      `Runtime token clear failed (${response.status}): ${text || "Unknown error"}`
    );
  }

  cachedRecord = {
    record: null,
    ts: Date.now()
  };
}
