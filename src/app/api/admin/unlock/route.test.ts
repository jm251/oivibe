import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    OI_VIBE_ADMIN_SECRET: "super-secret-admin-key"
  }
}));

vi.mock("@/lib/security/admin-session", () => ({
  setAdminSession: vi.fn()
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

vi.mock("@/lib/session/runtime", () => ({
  resolveRuntimeStatus: vi.fn().mockResolvedValue({
    connected: false,
    mode: "mock",
    adminUnlocked: true
  })
}));

import { POST } from "@/app/api/admin/unlock/route";
import { setAdminSession } from "@/lib/security/admin-session";

describe("POST /api/admin/unlock", () => {
  it("sets the operator session on a valid secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/unlock", {
        method: "POST",
        body: JSON.stringify({
          secret: "super-secret-admin-key"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(setAdminSession).toHaveBeenCalled();
    const payload = await response.json();
    expect(payload.adminUnlocked).toBe(true);
  });

  it("rejects invalid secrets", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/unlock", {
        method: "POST",
        body: JSON.stringify({
          secret: "wrong-secret-value"
        })
      })
    );

    expect(response.status).toBe(401);
  });
});
