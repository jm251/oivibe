import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    UPSTOX_NOTIFIER_SECRET: "notifier-secret-123"
  },
  hasRuntimeTokenStoreConfig: true,
  hasUpstoxTokenRequestConfig: true
}));

vi.mock("@/lib/security/guards", () => ({
  requireAdminApiAccess: vi.fn()
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  RateLimitError: class RateLimitError extends Error {
    constructor(
      message: string,
      public readonly resetAt: string
    ) {
      super(message);
    }
  }
}));

vi.mock("@/lib/upstox/rest", () => ({
  requestUpstoxAccessToken: vi.fn()
}));

import { POST } from "@/app/api/upstox/token-request/route";
import { requireAdminApiAccess } from "@/lib/security/guards";
import { requestUpstoxAccessToken } from "@/lib/upstox/rest";

describe("POST /api/upstox/token-request", () => {
  it("rejects unauthenticated callers", async () => {
    vi.mocked(requireAdminApiAccess).mockResolvedValue(
      new Response("forbidden", { status: 401 }) as never
    );

    const response = await POST(
      new Request("https://oivibe-five.vercel.app/api/upstox/token-request", {
        method: "POST"
      })
    );

    expect(response.status).toBe(401);
  });

  it("requests approval without leaking notifier secrets", async () => {
    vi.mocked(requireAdminApiAccess).mockResolvedValue(null);
    vi.mocked(requestUpstoxAccessToken).mockResolvedValue({
      notifier_url: "https://oivibe-five.vercel.app/api/upstox/notifier/notifier-secret-123",
      authorization_expiry: Date.UTC(2026, 2, 12, 4, 0, 0)
    });

    const response = await POST(
      new Request("https://oivibe-five.vercel.app/api/upstox/token-request", {
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.requested).toBe(true);
    expect(payload.authorizationExpiry).toBe("2026-03-12T04:00:00.000Z");
    expect(payload.expectedNotifierUrl).toBeUndefined();
    expect(payload.notifierUrl).toBeUndefined();
  });
});
