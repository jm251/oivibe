import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

function sanitize(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function secureSecretEquals(left: string | undefined, right: string | undefined) {
  const normalizedLeft = sanitize(left);
  const normalizedRight = sanitize(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return timingSafeEqual(digest(normalizedLeft), digest(normalizedRight));
}

