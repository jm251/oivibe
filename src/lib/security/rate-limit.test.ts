import { describe, expect, it } from "vitest";

import { buildRateLimitStorageKey } from "@/lib/security/rate-limit";

describe("buildRateLimitStorageKey", () => {
  it("produces an Edge Config-safe key", () => {
    const key = buildRateLimitStorageKey("admin-unlock", "192.168.1.10:443");

    expect(key).toMatch(/^[-_a-z0-9]+$/i);
    expect(key).not.toContain(":");
  });
});
