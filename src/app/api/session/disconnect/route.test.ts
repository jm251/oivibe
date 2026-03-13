import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  hasRuntimeTokenStoreConfig: true
}));

vi.mock("@/lib/security/guards", () => ({
  requireAdminApiAccess: vi.fn()
}));

vi.mock("@/lib/session/credentials", () => ({
  clearSessionCredentials: vi.fn()
}));

vi.mock("@/lib/session/runtime-token-store", () => ({
  clearRuntimeTokenRecord: vi.fn()
}));

vi.mock("@/lib/session/runtime", () => ({
  resolveRuntimeStatus: vi.fn().mockResolvedValue({
    connected: false,
    mode: "mock",
    adminUnlocked: true
  })
}));

import { POST } from "@/app/api/session/disconnect/route";
import { requireAdminApiAccess } from "@/lib/security/guards";
import { clearSessionCredentials } from "@/lib/session/credentials";
import { clearRuntimeTokenRecord } from "@/lib/session/runtime-token-store";

describe("POST /api/session/disconnect", () => {
  it("rejects unauthenticated callers", async () => {
    vi.mocked(requireAdminApiAccess).mockResolvedValue(
      new Response("forbidden", { status: 401 }) as never
    );

    const response = await POST();

    expect(response.status).toBe(401);
    expect(clearSessionCredentials).not.toHaveBeenCalled();
    expect(clearRuntimeTokenRecord).not.toHaveBeenCalled();
  });

  it("clears session and runtime credentials for an unlocked operator", async () => {
    vi.mocked(requireAdminApiAccess).mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(clearSessionCredentials).toHaveBeenCalled();
    expect(clearRuntimeTokenRecord).toHaveBeenCalled();
  });
});
