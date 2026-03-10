import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/upstox/oauth", () => ({
  consumeUpstoxOauthState: vi.fn()
}));

vi.mock("@/lib/upstox/rest", () => ({
  exchangeUpstoxAuthorizationCode: vi.fn(),
  validateUpstoxAccessToken: vi.fn()
}));

vi.mock("@/lib/session/credentials", () => ({
  setSessionCredentials: vi.fn()
}));

import { GET } from "@/app/api/upstox/callback/route";
import { setSessionCredentials } from "@/lib/session/credentials";
import { consumeUpstoxOauthState } from "@/lib/upstox/oauth";
import {
  exchangeUpstoxAuthorizationCode,
  validateUpstoxAccessToken
} from "@/lib/upstox/rest";

describe("GET /api/upstox/callback", () => {
  it("stores session and redirects back on successful oauth exchange", async () => {
    vi.mocked(consumeUpstoxOauthState).mockResolvedValue({
      valid: true,
      returnTo: "/strategy"
    });
    vi.mocked(exchangeUpstoxAuthorizationCode).mockResolvedValue("token-1234567890");
    vi.mocked(validateUpstoxAccessToken).mockResolvedValue(true);

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
    expect(validateUpstoxAccessToken).toHaveBeenCalledWith({
      accessToken: "token-1234567890"
    });
    expect(setSessionCredentials).toHaveBeenCalledWith({
      accessToken: "token-1234567890"
    });
  });

  it("rejects state mismatches", async () => {
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

  it("passes through upstream oauth errors", async () => {
    vi.mocked(consumeUpstoxOauthState).mockResolvedValue({
      valid: true,
      returnTo: "/"
    });

    const response = await GET(
      new Request(
        "http://localhost/api/upstox/callback?state=ok&error=access_denied&error_description=user+cancelled"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/?oauth=error&reason=user+cancelled"
    );
  });
});
