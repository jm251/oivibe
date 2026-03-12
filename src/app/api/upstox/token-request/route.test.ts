import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    UPSTOX_NOTIFIER_SECRET: "notifier-secret-123"
  },
  hasRuntimeTokenStoreConfig: true,
  hasUpstoxTokenRequestConfig: true
}));

vi.mock("@/lib/upstox/rest", () => ({
  requestUpstoxAccessToken: vi.fn()
}));

import { POST } from "@/app/api/upstox/token-request/route";
import { requestUpstoxAccessToken } from "@/lib/upstox/rest";

describe("POST /api/upstox/token-request", () => {
  it("requests approval and returns notifier metadata", async () => {
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
    expect(payload.notifierMatchesApp).toBe(true);
    expect(payload.expectedNotifierUrl).toBe(
      "https://oivibe-five.vercel.app/api/upstox/notifier/notifier-secret-123"
    );
  });
});
