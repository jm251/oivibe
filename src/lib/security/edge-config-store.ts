import "server-only";

import { env, hasRuntimeTokenStoreConfig } from "@/lib/env";

function sanitize(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function buildReadUrl(key: string) {
  const id = sanitize(env.UPSTOX_RUNTIME_EDGE_CONFIG_ID);
  return new URL(`https://edge-config.vercel.com/${id}/item/${encodeURIComponent(key)}`);
}

function buildMutationUrl() {
  const id = sanitize(env.UPSTOX_RUNTIME_EDGE_CONFIG_ID);
  const teamId = sanitize(env.UPSTOX_RUNTIME_VERCEL_TEAM_ID);
  const url = new URL(`https://api.vercel.com/v1/edge-config/${id}/items`);

  if (teamId) {
    url.searchParams.set("teamId", teamId);
  }

  return url;
}

function readHeaders() {
  return {
    Authorization: `Bearer ${sanitize(env.UPSTOX_RUNTIME_EDGE_CONFIG_TOKEN)}`
  };
}

function writeHeaders() {
  return {
    Authorization: `Bearer ${sanitize(env.UPSTOX_RUNTIME_VERCEL_API_TOKEN)}`,
    "Content-Type": "application/json"
  };
}

export async function readEdgeConfigItem<T>(key: string) {
  if (!hasRuntimeTokenStoreConfig) {
    return null;
  }

  const response = await fetch(buildReadUrl(key), {
    headers: readHeaders(),
    cache: "no-store"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Edge Config read failed (${response.status}): ${text || "Unknown error"}`
    );
  }

  return (await response.json()) as T | null;
}

export async function upsertEdgeConfigItem(key: string, value: unknown) {
  if (!hasRuntimeTokenStoreConfig) {
    throw new Error("Runtime token store is not configured");
  }

  const response = await fetch(buildMutationUrl(), {
    method: "PATCH",
    headers: writeHeaders(),
    body: JSON.stringify({
      items: [
        {
          operation: "upsert",
          key,
          value
        }
      ]
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Edge Config write failed (${response.status}): ${text || "Unknown error"}`
    );
  }
}

export async function deleteEdgeConfigItem(key: string) {
  if (!hasRuntimeTokenStoreConfig) {
    return;
  }

  const response = await fetch(buildMutationUrl(), {
    method: "PATCH",
    headers: writeHeaders(),
    body: JSON.stringify({
      items: [
        {
          operation: "delete",
          key
        }
      ]
    }),
    cache: "no-store"
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(
      `Edge Config delete failed (${response.status}): ${text || "Unknown error"}`
    );
  }
}
