import {
  env,
  hasRuntimeTokenStoreConfig,
  hasUpstoxOauthConfig,
  hasUpstoxTokenRequestConfig
} from "@/lib/env";
import { getSessionCredentials } from "@/lib/session/credentials";
import { readRuntimeTokenRecord } from "@/lib/session/runtime-token-store";
import { UpstoxCredentials } from "@/lib/upstox/types";
import { isExpiredIsoDate } from "@/lib/upstox/token-lifecycle";

interface ResolvedCredentials {
  source: "session" | "runtime" | "env" | "none";
  credentials: UpstoxCredentials | null;
  expiresAt?: string;
}

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

  return {
    connected: Boolean(resolved.credentials),
    mode: resolved.credentials ? ("live" as const) : ("mock" as const),
    source: resolved.source,
    expiresAt: resolved.expiresAt,
    oauthAvailable: hasUpstoxOauthConfig,
    tokenRequestAvailable:
      hasUpstoxTokenRequestConfig && hasRuntimeTokenStoreConfig,
    runtimeStoreAvailable: hasRuntimeTokenStoreConfig,
    requiresApproval:
      !resolved.credentials &&
      hasUpstoxTokenRequestConfig &&
      hasRuntimeTokenStoreConfig
  };
}
