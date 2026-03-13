import "server-only";

import { createHash } from "node:crypto";

import { env, hasRuntimeTokenStoreConfig } from "@/lib/env";
import { readEdgeConfigItem, upsertEdgeConfigItem } from "@/lib/security/edge-config-store";

type RateLimitAction =
  | "admin-unlock"
  | "session-connect"
  | "token-request"
  | "notifier"
  | "oauth-login"
  | "oauth-callback";

interface RateLimitRule {
  limit: number;
  windowMs: number;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
  updatedAt: string;
}

const RATE_LIMIT_RULES: Record<RateLimitAction, RateLimitRule> = {
  "admin-unlock": {
    limit: 8,
    windowMs: 10 * 60 * 1000
  },
  "session-connect": {
    limit: 5,
    windowMs: 10 * 60 * 1000
  },
  "token-request": {
    limit: 5,
    windowMs: 10 * 60 * 1000
  },
  notifier: {
    limit: 20,
    windowMs: 10 * 60 * 1000
  },
  "oauth-login": {
    limit: 10,
    windowMs: 10 * 60 * 1000
  },
  "oauth-callback": {
    limit: 15,
    windowMs: 10 * 60 * 1000
  }
};

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly resetAt: string
  ) {
    super(message);
  }
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export async function assertRateLimit(req: Request, action: RateLimitAction) {
  if (env.NODE_ENV === "test" || !hasRuntimeTokenStoreConfig) {
    return;
  }

  const rule = RATE_LIMIT_RULES[action];
  const now = Date.now();
  const key = `rate_limit:${action}:${hashKey(getClientIp(req))}`;
  const record = await readEdgeConfigItem<RateLimitRecord>(key);
  const next =
    record && record.resetAt > now
      ? {
          count: record.count + 1,
          resetAt: record.resetAt,
          updatedAt: new Date(now).toISOString()
        }
      : {
          count: 1,
          resetAt: now + rule.windowMs,
          updatedAt: new Date(now).toISOString()
        };

  await upsertEdgeConfigItem(key, next);

  if (next.count > rule.limit) {
    throw new RateLimitError(
      `Too many requests for ${action}. Try again later.`,
      new Date(next.resetAt).toISOString()
    );
  }
}
