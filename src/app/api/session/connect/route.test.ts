import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/upstox/rest", () => ({
  validateUpstoxAccessToken: vi.fn()
}));

vi.mock("@/lib/session/credentials", () => ({
  setSessionCredentials: vi.fn()
}));

import { POST } from "@/app/api/session/connect/route";
import { setSessionCredentials } from "@/lib/session/credentials";
import { validateUpstoxAccessToken } from "@/lib/upstox/rest";

describe("POST /api/session/connect", () => {
  it("stores session on valid Upstox token", async () => {
    vi.mocked(validateUpstoxAccessToken).mockResolvedValue(true);

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
      accessToken: "x".repeat(40)
    });

    const payload = await response.json();
    expect(payload.mode).toBe("live");
  });

  it("falls back to mock on invalid token", async () => {
    vi.mocked(validateUpstoxAccessToken).mockRejectedValue(new Error("invalid"));

    const response = await POST(
      new Request("http://localhost/api/session/connect", {
        method: "POST",
        body: JSON.stringify({
          accessToken: "x".repeat(40)
        })
      })
    );

    const payload = await response.json();
    expect(payload.mode).toBe("mock");
  });
});
