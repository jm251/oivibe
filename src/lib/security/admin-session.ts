import "server-only";

import { cookies } from "next/headers";

import { decryptCookiePayload, encryptCookiePayload } from "@/lib/security/secure-cookie";

const COOKIE_NAME = "oi_vibe_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12;

interface AdminSessionPayload {
  unlockedAt: string;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  };
}

export async function setAdminSession() {
  const store = await cookies();
  const payload: AdminSessionPayload = {
    unlockedAt: new Date().toISOString()
  };

  store.set(COOKIE_NAME, encryptCookiePayload(JSON.stringify(payload)), cookieOptions());
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getAdminSession() {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }

  try {
    const decoded = decryptCookiePayload(raw);
    const parsed = JSON.parse(decoded) as AdminSessionPayload;
    if (!parsed.unlockedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function hasAdminSession() {
  return Boolean(await getAdminSession());
}
