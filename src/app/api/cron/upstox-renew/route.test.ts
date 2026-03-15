import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  hasRuntimeTokenStoreConfig: true,
  hasUpstoxTokenRequestConfig: true
}));

vi.mock("@/lib/security/guards", () => ({
  requireCronApiAccess: vi.fn()
}));

vi.mock("@/lib/upstox/token-request-flow", () => ({
  requestUpstoxApproval: vi.fn()
}));

import { GET } from "@/app/api/cron/upstox-renew/route";
import { requireCronApiAccess } from "@/lib/security/guards";
import { requestUpstoxApproval } from "@/lib/upstox/token-request-flow";

describe("GET /api/cron/upstox-renew", () => {
  it("rejects unauthorized cron callers", async () => {
    vi.mocked(requireCronApiAccess).mockReturnValue(
      new Response("forbidden", { status: 401 }) as never
    );

    const response = await GET(
      new Request("https://oivibe-five.vercel.app/api/cron/upstox-renew")
    );

    expect(response.status).toBe(401);
  });

  it("requests approval through the shared flow", async () => {
    vi.mocked(requireCronApiAccess).mockReturnValue(null);
    vi.mocked(requestUpstoxApproval).mockResolvedValue({
      requested: true,
      authorizationExpiry: "2026-03-15T22:00:00.000Z"
    });

    const response = await GET(
      new Request("https://oivibe-five.vercel.app/api/cron/upstox-renew", {
        headers: {
          Authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.trigger).toBe("cron");
    expect(payload.requested).toBe(true);
    expect(payload.authorizationExpiry).toBe("2026-03-15T22:00:00.000Z");
  });

  it("returns skipped when the existing token is still healthy", async () => {
    vi.mocked(requireCronApiAccess).mockReturnValue(null);
    vi.mocked(requestUpstoxApproval).mockResolvedValue({
      requested: false,
      reason: "TOKEN_STILL_VALID",
      expiresAt: "2026-03-16T22:00:00.000Z"
    });

    const response = await GET(
      new Request("https://oivibe-five.vercel.app/api/cron/upstox-renew", {
        headers: {
          Authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.trigger).toBe("cron");
    expect(payload.requested).toBe(false);
    expect(payload.reason).toBe("TOKEN_STILL_VALID");
  });
});
