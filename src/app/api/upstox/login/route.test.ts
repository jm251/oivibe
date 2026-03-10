import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/upstox/oauth", () => ({
  beginUpstoxOauth: vi.fn()
}));

import { GET } from "@/app/api/upstox/login/route";
import { beginUpstoxOauth } from "@/lib/upstox/oauth";

describe("GET /api/upstox/login", () => {
  it("redirects to the Upstox authorization dialog", async () => {
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

  it("redirects home with an error when oauth config is invalid", async () => {
    vi.mocked(beginUpstoxOauth).mockRejectedValue(
      new Error("UPSTOX_REDIRECT_URI is not configured")
    );

    const response = await GET(new Request("http://localhost/api/upstox/login"));
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toContain("/?oauth=error");
    expect(location).toContain(
      "reason=UPSTOX_REDIRECT_URI+is+not+configured"
    );
  });
});
