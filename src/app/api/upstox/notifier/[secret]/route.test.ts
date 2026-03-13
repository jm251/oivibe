import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    UPSTOX_NOTIFIER_SECRET: "notifier-secret-123",
    UPSTOX_API_KEY: "demo-client-id",
    UPSTOX_ALLOWED_USER_ID: "FN196820"
  },
  hasRuntimeTokenStoreConfig: true,
  hasUpstoxTokenRequestConfig: true
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
  validateAllowedUpstoxUser: vi.fn()
}));

vi.mock("@/lib/session/runtime-token-store", () => ({
  writeRuntimeTokenRecord: vi.fn()
}));

import { POST } from "@/app/api/upstox/notifier/[secret]/route";
import { writeRuntimeTokenRecord } from "@/lib/session/runtime-token-store";
import { validateAllowedUpstoxUser } from "@/lib/upstox/rest";

describe("POST /api/upstox/notifier/[secret]", () => {
  it("stores a validated runtime token for the allowed user", async () => {
    vi.mocked(validateAllowedUpstoxUser).mockResolvedValue({
      userId: "FN196820"
    });

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
            user_id: "FN196820"
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
      userId: "FN196820",
      tokenType: "Bearer"
    });
  });

  it("rejects mismatched notifier users", async () => {
    vi.mocked(validateAllowedUpstoxUser).mockResolvedValue({
      userId: "FN196820"
    });

    const response = await POST(
      new Request(
        "https://oivibe-five.vercel.app/api/upstox/notifier/notifier-secret-123",
        {
          method: "POST",
          body: JSON.stringify({
            client_id: "demo-client-id",
            access_token: "x".repeat(40),
            user_id: "DIFFERENT"
          })
        }
      ),
      {
        params: Promise.resolve({
          secret: "notifier-secret-123"
        })
      }
    );

    expect(response.status).toBe(403);
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
