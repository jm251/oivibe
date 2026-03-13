import {
  env,
  hasRuntimeTokenStoreConfig,
  hasUpstoxOauthConfig,
  hasUpstoxTokenRequestConfig
} from "@/lib/env";
import { hasAdminSession } from "@/lib/security/admin-session";
import { getSessionCredentials } from "@/lib/session/credentials";
import { readRuntimeTokenRecord } from "@/lib/session/runtime-token-store";
import { UpstoxCredentials } from "@/lib/upstox/types";
import {
  computeUpstoxAccessTokenExpiry,
  isExpiredIsoDate
} from "@/lib/upstox/token-lifecycle";
import {
  fetchUpstoxUserProfile,
  validateUpstoxAccessToken
} from "@/lib/upstox/rest";

interface ResolvedCredentials {
  source: "session" | "runtime" | "env" | "none";
  credentials: UpstoxCredentials | null;
  expiresAt?: string;
  userId?: string;
}

const TOKEN_VALIDATION_CACHE_MS = 60_000;

let tokenValidationCache:
  | {
      key: string;
      valid: boolean;
      userId?: string;
      ts: number;
    }
  | null = null;

function sanitize(input: string | undefined) {
  return input?.trim().replace(/^['\"]|['\"]$/g, "") ?? "";
}

function sanitizeUserId(input: string | undefined) {
  return sanitize(input).toUpperCase();
}

async function resolveValidatedUserId(
  credentials: UpstoxCredentials,
  knownUserId?: string
) {
  const allowedUserId = sanitizeUserId(env.UPSTOX_ALLOWED_USER_ID);

  if (!allowedUserId) {
    return {
      valid: true,
      userId: sanitizeUserId(knownUserId)
    };
  }

  const userId = sanitizeUserId(knownUserId);
  if (userId) {
    return {
      valid: userId === allowedUserId,
      userId
    };
  }

  const cacheKey = `${sanitize(credentials.accessToken).slice(-24)}:${allowedUserId}`;
  const now = Date.now();

  if (
    tokenValidationCache &&
    tokenValidationCache.key === cacheKey &&
    now - tokenValidationCache.ts < TOKEN_VALIDATION_CACHE_MS
  ) {
    return {
      valid: tokenValidationCache.valid,
      userId: tokenValidationCache.userId
    };
  }

  try {
    const profile = await fetchUpstoxUserProfile(credentials);
    const resolvedUserId = sanitizeUserId(profile.user_id);
    const valid = Boolean(resolvedUserId && resolvedUserId === allowedUserId);
    tokenValidationCache = {
      key: cacheKey,
      valid,
      userId: resolvedUserId,
      ts: now
    };

    return {
      valid,
      userId: resolvedUserId
    };
  } catch {
    tokenValidationCache = {
      key: cacheKey,
      valid: false,
      userId: undefined,
      ts: now
    };

    return {
      valid: false,
      userId: undefined
    };
  }
}

export async function resolveRuntimeCredentials(): Promise<ResolvedCredentials> {
  const fromSession = await getSessionCredentials();
  if (fromSession?.accessToken && !isExpiredIsoDate(fromSession.expiresAt)) {
    const credentials = {
      accessToken: sanitize(fromSession.accessToken)
    };
    const resolvedUser = await resolveValidatedUserId(credentials, fromSession.userId);
    if (resolvedUser.valid) {
      return {
        source: "session",
        credentials,
        expiresAt: fromSession.expiresAt,
        userId: resolvedUser.userId
      };
    }
  }

  if (hasRuntimeTokenStoreConfig) {
    try {
      const fromRuntime = await readRuntimeTokenRecord();
      if (fromRuntime?.accessToken && !isExpiredIsoDate(fromRuntime.expiresAt)) {
        const credentials = {
          accessToken: sanitize(fromRuntime.accessToken)
        };
        const resolvedUser = await resolveValidatedUserId(credentials, fromRuntime.userId);
        if (resolvedUser.valid) {
          return {
            source: "runtime",
            credentials,
            expiresAt: fromRuntime.expiresAt,
            userId: resolvedUser.userId
          };
        }
      }
    } catch {
      // Runtime storage is optional; fall through to env/mock paths.
    }
  }

  const envAccessToken = sanitize(env.UPSTOX_ACCESS_TOKEN);
  if (envAccessToken) {
    const credentials = {
      accessToken: envAccessToken
    };
    const resolvedUser = await resolveValidatedUserId(credentials);
    if (resolvedUser.valid) {
      return {
        source: "env",
        credentials,
        userId: resolvedUser.userId
      };
    }
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
  const adminUnlocked = await hasAdminSession();

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
          userId: resolved.userId,
          ts: now
        };
      } catch {
        connected = false;
        tokenValidationCache = {
          key: cacheKey,
          valid: false,
          userId: resolved.userId,
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
    requiresApproval: !connected && tokenRequestAvailable,
    adminUnlocked
  };
}
