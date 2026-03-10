import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_SECRET: z.string().min(16).optional(),
  UPSTOX_API_KEY: z.string().optional(),
  UPSTOX_API_SECRET: z.string().optional(),
  UPSTOX_REDIRECT_URI: z.string().optional(),
  UPSTOX_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default("OI VIBE")
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  SESSION_SECRET: process.env.SESSION_SECRET,
  UPSTOX_API_KEY: process.env.UPSTOX_API_KEY,
  UPSTOX_API_SECRET: process.env.UPSTOX_API_SECRET,
  UPSTOX_REDIRECT_URI: process.env.UPSTOX_REDIRECT_URI,
  UPSTOX_ACCESS_TOKEN: process.env.UPSTOX_ACCESS_TOKEN,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME
});

export const hasEnvUpstoxCredentials = Boolean(env.UPSTOX_ACCESS_TOKEN);
