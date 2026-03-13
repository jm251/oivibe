import { cookies } from "next/headers";

import {
  decryptCookiePayload,
  encryptCookiePayload
} from "@/lib/security/secure-cookie";

const COOKIE_NAME = "oi_vibe_session";

export interface SessionCredentials {
  accessToken: string;
  issuedAt?: string;
  expiresAt?: string;
  userId?: string;
}

export async function setSessionCredentials(credentials: SessionCredentials) {
  const store = await cookies();
  const payload = encryptCookiePayload(JSON.stringify(credentials));
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
    const decoded = decryptCookiePayload(raw);
    const parsed = JSON.parse(decoded) as SessionCredentials;
    if (!parsed.accessToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
