import { env } from "@/lib/env";
import { getSessionCredentials } from "@/lib/session/credentials";
import { UpstoxCredentials } from "@/lib/upstox/types";

interface ResolvedCredentials {
  source: "session" | "env" | "none";
  credentials: UpstoxCredentials | null;
}

function sanitize(input: string | undefined) {
  return input?.trim().replace(/^['\"]|['\"]$/g, "") ?? "";
}

export async function resolveRuntimeCredentials(): Promise<ResolvedCredentials> {
  const fromSession = await getSessionCredentials();
  if (fromSession?.accessToken) {
    return {
      source: "session",
      credentials: {
        accessToken: sanitize(fromSession.accessToken)
      }
    };
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
    credentials: null
  };
}
