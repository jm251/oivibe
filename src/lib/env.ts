import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_SECRET: z.string().min(16).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  OI_VIBE_ADMIN_SECRET: z.string().min(16).optional(),
  UPSTOX_API_KEY: z.string().optional(),
  UPSTOX_API_SECRET: z.string().optional(),
  UPSTOX_REDIRECT_URI: z.string().optional(),
  UPSTOX_ACCESS_TOKEN: z.string().optional(),
  UPSTOX_ALLOWED_USER_ID: z.string().min(2).optional(),
  UPSTOX_NOTIFIER_SECRET: z.string().min(12).optional(),
  UPSTOX_RUNTIME_EDGE_CONFIG_ID: z.string().optional(),
  UPSTOX_RUNTIME_EDGE_CONFIG_TOKEN: z.string().optional(),
  UPSTOX_RUNTIME_VERCEL_API_TOKEN: z.string().optional(),
  UPSTOX_RUNTIME_VERCEL_TEAM_ID: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default("OI VIBE")
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  SESSION_SECRET: process.env.SESSION_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  OI_VIBE_ADMIN_SECRET: process.env.OI_VIBE_ADMIN_SECRET,
  UPSTOX_API_KEY: process.env.UPSTOX_API_KEY,
  UPSTOX_API_SECRET: process.env.UPSTOX_API_SECRET,
  UPSTOX_REDIRECT_URI: process.env.UPSTOX_REDIRECT_URI,
  UPSTOX_ACCESS_TOKEN: process.env.UPSTOX_ACCESS_TOKEN,
  UPSTOX_ALLOWED_USER_ID: process.env.UPSTOX_ALLOWED_USER_ID,
  UPSTOX_NOTIFIER_SECRET: process.env.UPSTOX_NOTIFIER_SECRET,
  UPSTOX_RUNTIME_EDGE_CONFIG_ID: process.env.UPSTOX_RUNTIME_EDGE_CONFIG_ID,
  UPSTOX_RUNTIME_EDGE_CONFIG_TOKEN:
    process.env.UPSTOX_RUNTIME_EDGE_CONFIG_TOKEN,
  UPSTOX_RUNTIME_VERCEL_API_TOKEN: process.env.UPSTOX_RUNTIME_VERCEL_API_TOKEN,
  UPSTOX_RUNTIME_VERCEL_TEAM_ID: process.env.UPSTOX_RUNTIME_VERCEL_TEAM_ID,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME
});

if (env.NODE_ENV === "production") {
  const required = [
    ["SESSION_SECRET", env.SESSION_SECRET],
    ["CRON_SECRET", env.CRON_SECRET],
    ["OI_VIBE_ADMIN_SECRET", env.OI_VIBE_ADMIN_SECRET],
    ["UPSTOX_ALLOWED_USER_ID", env.UPSTOX_ALLOWED_USER_ID],
    ["UPSTOX_NOTIFIER_SECRET", env.UPSTOX_NOTIFIER_SECRET]
  ].filter(([, value]) => !value);

  if (required.length > 0) {
    throw new Error(
      `Missing required production env vars: ${required.map(([key]) => key).join(", ")}`
    );
  }
}

export const hasEnvUpstoxCredentials = Boolean(env.UPSTOX_ACCESS_TOKEN);
export const hasUpstoxOauthConfig = Boolean(
  env.UPSTOX_API_KEY && env.UPSTOX_API_SECRET && env.UPSTOX_REDIRECT_URI
);
export const hasUpstoxTokenRequestConfig = Boolean(
  env.UPSTOX_API_KEY && env.UPSTOX_API_SECRET && env.UPSTOX_NOTIFIER_SECRET
);
export const hasRuntimeTokenStoreConfig = Boolean(
  env.UPSTOX_RUNTIME_EDGE_CONFIG_ID &&
    env.UPSTOX_RUNTIME_EDGE_CONFIG_TOKEN &&
    env.UPSTOX_RUNTIME_VERCEL_API_TOKEN
);
