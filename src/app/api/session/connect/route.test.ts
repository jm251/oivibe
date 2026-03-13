import { describe, expect, it, vi } from "vitest";

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
  validateAllowedUpstoxUser: vi.fn()
}));

vi.mock("@/lib/session/credentials", () => ({
  setSessionCredentials: vi.fn()
}));

import { POST } from "@/app/api/session/connect/route";
import { requireAdminApiAccess } from "@/lib/security/guards";
import { setSessionCredentials } from "@/lib/session/credentials";
import { validateAllowedUpstoxUser } from "@/lib/upstox/rest";
import { isExpiredIsoDate } from "@/lib/upstox/token-lifecycle";

describe("POST /api/session/connect", () => {
  it("rejects unauthenticated callers", async () => {
    vi.mocked(requireAdminApiAccess).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "ADMIN_UNLOCK_REQUIRED",
          message: "Operator unlock is required for this action."
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json"
          }
        }
      ) as never
    );

    const response = await POST(
      new Request("http://localhost/api/session/connect", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "x".repeat(40)
        })
      })
    );

    expect(response.status).toBe(401);
  });

  it("stores session on a valid allowed Upstox token", async () => {
    vi.mocked(requireAdminApiAccess).mockResolvedValue(null);
    vi.mocked(validateAllowedUpstoxUser).mockResolvedValue({
      userId: "FN196820"
    });

    const response = await POST(
      new Request("http://localhost/api/session/connect", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "x".repeat(40)
        })
      })
    );

    expect(response.status).toBe(200);
    expect(setSessionCredentials).toHaveBeenCalledWith({
      accessToken: "x".repeat(40),
      expiresAt: expect.any(String),
      issuedAt: expect.any(String),
      userId: "FN196820"
    });

    const payload = vi.mocked(setSessionCredentials).mock.calls[0]?.[0];
    expect(isExpiredIsoDate(payload?.expiresAt, new Date(payload?.issuedAt ?? ""))).toBe(false);
    const body = await response.json();
    expect(body.mode).toBe("live");
    expect(body.adminUnlocked).toBe(true);
  });

  it("rejects tokens for the wrong Upstox user", async () => {
    vi.mocked(requireAdminApiAccess).mockResolvedValue(null);
    vi.mocked(validateAllowedUpstoxUser).mockRejectedValue(
      new Error("Upstox user is not allowed for this deployment")
    );

    const response = await POST(
      new Request("http://localhost/api/session/connect", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "x".repeat(40)
        })
      })
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.message).toContain("not allowed");
  });
});
