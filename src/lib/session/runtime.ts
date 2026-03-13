import {
  env,
  hasRuntimeTokenStoreConfig,
  hasUpstoxOauthConfig,
  hasUpstoxTokenRequestConfig
} from "@/lib/env";
import { getSessionCredentials } from "@/lib/session/credentials";
import { readRuntimeTokenRecord } from "@/lib/session/runtime-token-store";
import { UpstoxCredentials } from "@/lib/upstox/types";
import {
  computeUpstoxAccessTokenExpiry,
  isExpiredIsoDate
} from "@/lib/upstox/token-lifecycle";
import { validateUpstoxAccessToken } from "@/lib/upstox/rest";

interface ResolvedCredentials {
  source: "session" | "runtime" | "env" | "none";
  credentials: UpstoxCredentials | null;
  expiresAt?: string;
}

const TOKEN_VALIDATION_CACHE_MS = 60_000;

let tokenValidationCache:
  | {
      key: string;
      valid: boolean;
      ts: number;
    }
  | null = null;

function sanitize(input: string | undefined) {
  return input?.trim().replace(/^['\"]|['\"]$/g, "") ?? "";
}

export async function resolveRuntimeCredentials(): Promise<ResolvedCredentials> {
  const fromSession = await getSessionCredentials();
  if (fromSession?.accessToken && !isExpiredIsoDate(fromSession.expiresAt)) {
    return {
      source: "session",
      credentials: {
        accessToken: sanitize(fromSession.accessToken)
      },
      expiresAt: fromSession.expiresAt
    };
  }

  if (hasRuntimeTokenStoreConfig) {
    try {
      const fromRuntime = await readRuntimeTokenRecord();
      if (fromRuntime?.accessToken && !isExpiredIsoDate(fromRuntime.expiresAt)) {
        return {
          source: "runtime",
          credentials: {
            accessToken: sanitize(fromRuntime.accessToken)
          },
          expiresAt: fromRuntime.expiresAt
        };
      }
    } catch {
      // Runtime storage is optional; fall through to env/mock paths.
    }
  }

  const envAccessToken = sanitize(env.UPSTOX_ACCESS_TOKEN);
  if (envAccessToken) {
    return {
      source: "env",
      credentials: {
        accessToken: envAccessToken
      }
    };
  }

  return {
    source: "none",
    credentials: null,
    expiresAt: undefined
  };
}

export async function resolveRuntimeStatus() {
  const resolved = await resolveRuntimeCredentials();
  const tokenRequestAvailable =
    hasUpstoxTokenRequestConfig && hasRuntimeTokenStoreConfig;

  let connected = Boolean(resolved.credentials);
  let mode = resolved.credentials ? ("live" as const) : ("mock" as const);
  let source = resolved.source;
  let expiresAt = resolved.expiresAt;

  if (resolved.source === "env" && resolved.credentials) {
    const cacheKey = sanitize(resolved.credentials.accessToken).slice(-24);
    const now = Date.now();

    if (
      tokenValidationCache &&
      tokenValidationCache.key === cacheKey &&
      now - tokenValidationCache.ts < TOKEN_VALIDATION_CACHE_MS
    ) {
      connected = tokenValidationCache.valid;
    } else {
      try {
        await validateUpstoxAccessToken(resolved.credentials);
        connected = true;
        tokenValidationCache = {
          key: cacheKey,
          valid: true,
          ts: now
        };
      } catch {
        connected = false;
        tokenValidationCache = {
          key: cacheKey,
          valid: false,
          ts: now
        };
      }
    }

    if (connected && !expiresAt) {
      expiresAt = computeUpstoxAccessTokenExpiry();
    }
  }

  if (!connected) {
    mode = "mock";
    source = "none";
    expiresAt = undefined;
  }

  return {
    connected,
    mode,
    source,
    expiresAt,
    oauthAvailable: hasUpstoxOauthConfig,
    tokenRequestAvailable,
    runtimeStoreAvailable: hasRuntimeTokenStoreConfig,
    requiresApproval: !connected && tokenRequestAvailable
  };
}
