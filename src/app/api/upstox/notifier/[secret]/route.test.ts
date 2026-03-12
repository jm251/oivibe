import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    UPSTOX_NOTIFIER_SECRET: "notifier-secret-123",
    UPSTOX_API_KEY: "demo-client-id"
  },
  hasRuntimeTokenStoreConfig: true,
  hasUpstoxTokenRequestConfig: true
}));

vi.mock("@/lib/upstox/rest", () => ({
  validateUpstoxAccessToken: vi.fn()
}));

vi.mock("@/lib/session/runtime-token-store", () => ({
  writeRuntimeTokenRecord: vi.fn()
}));

import { POST } from "@/app/api/upstox/notifier/[secret]/route";
import { writeRuntimeTokenRecord } from "@/lib/session/runtime-token-store";

describe("POST /api/upstox/notifier/[secret]", () => {
  it("stores a validated runtime token", async () => {
    const response = await POST(
      new Request(
        "https://oivibe-five.vercel.app/api/upstox/notifier/notifier-secret-123",
        {
          method: "POST",
          body: JSON.stringify({
            client_id: "demo-client-id",
            access_token: "x".repeat(40),
            token_type: "Bearer",
            issued_at: Date.UTC(2026, 2, 12, 3, 0, 0),
            expires_at: Date.UTC(2026, 2, 13, 3, 30, 0),
            user_id: "AB1234"
          })
        }
      ),
      {
        params: Promise.resolve({
          secret: "notifier-secret-123"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(writeRuntimeTokenRecord).toHaveBeenCalledWith({
      accessToken: "x".repeat(40),
      issuedAt: "2026-03-12T03:00:00.000Z",
      expiresAt: "2026-03-13T03:30:00.000Z",
      userId: "AB1234",
      tokenType: "Bearer"
    });
  });

  it("rejects bad secrets", async () => {
    const response = await POST(
      new Request(
        "https://oivibe-five.vercel.app/api/upstox/notifier/wrong-secret",
        {
          method: "POST",
          body: JSON.stringify({
            client_id: "demo-client-id",
            access_token: "x".repeat(40)
          })
        }
      ),
      {
        params: Promise.resolve({
          secret: "wrong-secret"
        })
      }
    );

    expect(response.status).toBe(401);
  });
});
