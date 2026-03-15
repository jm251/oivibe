import "server-only";

import { env } from "@/lib/env";
import { requestUpstoxAccessToken } from "@/lib/upstox/rest";
import { resolveRuntimeStatus } from "@/lib/session/runtime";

function sanitize(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function toIsoDate(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const ts = typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(ts)) {
    return undefined;
  }

  return new Date(ts).toISOString();
}

function expiresSoon(expiresAt: string | undefined, now = Date.now()) {
  if (!expiresAt) {
    return true;
  }

  const expiresTs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresTs)) {
    return true;
  }

  return expiresTs - now <= 30 * 60 * 1000;
}

export async function requestUpstoxApproval(baseUrl: string) {
  const status = await resolveRuntimeStatus();

  if (status.connected && !expiresSoon(status.expiresAt)) {
    return {
      requested: false as const,
      reason: "TOKEN_STILL_VALID",
      expiresAt: status.expiresAt
    };
  }

  const payload = await requestUpstoxAccessToken();
  const expectedNotifierUrl = new URL(
    `/api/upstox/notifier/${sanitize(env.UPSTOX_NOTIFIER_SECRET)}`,
    baseUrl
  ).toString();

  if (!payload.notifier_url) {
    throw new Error("Upstox did not return a notifier URL.");
  }

  if (payload.notifier_url !== expectedNotifierUrl) {
    throw new Error("Configured Upstox notifier URL does not match this deployment.");
  }

  return {
    requested: true as const,
    authorizationExpiry: toIsoDate(payload.authorization_expiry)
  };
}
