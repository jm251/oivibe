import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";

function resolveSecret() {
  if (!env.SESSION_SECRET) {
    if (env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be configured in production");
    }

    return createHash("sha256")
      .update("oi-vibe-local-dev-secret-change-me")
      .digest();
  }

  return createHash("sha256").update(env.SESSION_SECRET).digest();
}

export function encryptCookiePayload(value: string) {
  const key = resolveSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptCookiePayload(payload: string) {
  const key = resolveSecret();
  const data = Buffer.from(payload, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
