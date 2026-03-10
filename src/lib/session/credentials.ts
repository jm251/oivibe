import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

const COOKIE_NAME = "oi_vibe_session";
const ALGORITHM = "aes-256-gcm";

export interface SessionCredentials {
  accessToken: string;
}

function resolveSecret() {
  const base =
    env.SESSION_SECRET ??
    process.env.JWT_SECRET ??
    "oi-vibe-local-dev-secret-change-me";
  return createHash("sha256").update(base).digest();
}

function encrypt(value: string) {
  const key = resolveSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt(payload: string) {
  const key = resolveSecret();
  const data = Buffer.from(payload, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function setSessionCredentials(credentials: SessionCredentials) {
  const store = await cookies();
  const payload = encrypt(JSON.stringify(credentials));
  store.set(COOKIE_NAME, payload, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function clearSessionCredentials() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionCredentials(): Promise<SessionCredentials | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }

  try {
    const decoded = decrypt(raw);
    const parsed = JSON.parse(decoded) as SessionCredentials;
    if (!parsed.accessToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
