import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/security/guards", () => ({
  requireAdminPageAccess: vi.fn()
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

vi.mock("@/lib/upstox/oauth", () => ({
  consumeUpstoxOauthState: vi.fn()
}));

vi.mock("@/lib/upstox/rest", () => ({
  exchangeUpstoxAuthorizationCode: vi.fn(),
  validateAllowedUpstoxUser: vi.fn()
}));

vi.mock("@/lib/session/credentials", () => ({
  setSessionCredentials: vi.fn()
}));

import { GET } from "@/app/api/upstox/callback/route";
import { requireAdminPageAccess } from "@/lib/security/guards";
import { setSessionCredentials } from "@/lib/session/credentials";
import { consumeUpstoxOauthState } from "@/lib/upstox/oauth";
import {
  exchangeUpstoxAuthorizationCode,
  validateAllowedUpstoxUser
} from "@/lib/upstox/rest";
import { isExpiredIsoDate } from "@/lib/upstox/token-lifecycle";

describe("GET /api/upstox/callback", () => {
  it("rejects callers without an operator session", async () => {
    vi.mocked(requireAdminPageAccess).mockResolvedValue(
      new Response("forbidden", { status: 403 }) as never
    );

    const response = await GET(
      new Request("http://localhost/api/upstox/callback?code=abc123&state=state123")
    );

    expect(response.status).toBe(403);
  });

  it("stores session and redirects back on successful oauth exchange", async () => {
    vi.mocked(requireAdminPageAccess).mockResolvedValue(null);
    vi.mocked(consumeUpstoxOauthState).mockResolvedValue({
      valid: true,
      returnTo: "/strategy"
    });
    vi.mocked(exchangeUpstoxAuthorizationCode).mockResolvedValue("token-1234567890");
    vi.mocked(validateAllowedUpstoxUser).mockResolvedValue({
      userId: "FN196820"
    });

    const response = await GET(
      new Request(
        "http://localhost/api/upstox/callback?code=abc123&state=state123"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/strategy?oauth=connected"
    );
    expect(exchangeUpstoxAuthorizationCode).toHaveBeenCalledWith("abc123");
    expect(validateAllowedUpstoxUser).toHaveBeenCalledWith({
      accessToken: "token-1234567890"
    });
    expect(setSessionCredentials).toHaveBeenCalledWith({
      accessToken: "token-1234567890",
      issuedAt: expect.any(String),
      expiresAt: expect.any(String),
      userId: "FN196820"
    });
    const payload = vi.mocked(setSessionCredentials).mock.calls[0]?.[0];
    expect(isExpiredIsoDate(payload?.expiresAt, new Date(payload?.issuedAt ?? ""))).toBe(false);
  });

  it("rejects state mismatches", async () => {
    vi.mocked(requireAdminPageAccess).mockResolvedValue(null);
    vi.mocked(consumeUpstoxOauthState).mockResolvedValue({
      valid: false,
      returnTo: "/"
    });

    const response = await GET(
      new Request(
        "http://localhost/api/upstox/callback?code=abc123&state=wrong-state"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/?oauth=error&reason=state_mismatch"
    );
  });
});
