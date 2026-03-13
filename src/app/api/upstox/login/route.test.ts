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
  beginUpstoxOauth: vi.fn()
}));

import { GET } from "@/app/api/upstox/login/route";
import { requireAdminPageAccess } from "@/lib/security/guards";
import { beginUpstoxOauth } from "@/lib/upstox/oauth";

describe("GET /api/upstox/login", () => {
  it("rejects unauthenticated callers", async () => {
    vi.mocked(requireAdminPageAccess).mockResolvedValue(
      new Response("forbidden", { status: 403 }) as never
    );

    const response = await GET(new Request("http://localhost/api/upstox/login"));
    expect(response.status).toBe(403);
  });

  it("redirects to the Upstox authorization dialog", async () => {
    vi.mocked(requireAdminPageAccess).mockResolvedValue(null);
    vi.mocked(beginUpstoxOauth).mockResolvedValue(
      "https://api.upstox.com/v2/login/authorization/dialog?state=test"
    );

    const response = await GET(
      new Request("http://localhost/api/upstox/login?returnTo=%2Fstrategy")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://api.upstox.com/v2/login/authorization/dialog?state=test"
    );
    expect(beginUpstoxOauth).toHaveBeenCalledWith("/strategy");
  });
});
