import { describe, it, expect, beforeEach } from "vitest";
import { authAdapter } from "@/lib/auth";

describe("Local-first Auth Adapter", () => {
  beforeEach(async () => {
    await authAdapter.logout();
  });

  it("handles signUp validation and truthful early-access response", async () => {
    const invalidRes = await authAdapter.signUp("invalid-email", "secret123");
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.message).toContain("valid email");

    const validRes = await authAdapter.signUp("tester@example.com", "secret123");
    expect(validRes.success).toBe(true);
    expect(validRes.message).toContain("strictly on this device");
    expect(validRes.session).toBeNull();
  });

  it("handles login with honest preview messaging and zero cloud claims", async () => {
    const invalidRes = await authAdapter.login("", "secret123");
    expect(invalidRes.success).toBe(false);

    const validRes = await authAdapter.login("tester@example.com", "secret123");
    expect(validRes.success).toBe(true);
    expect(validRes.message).toContain("locally with complete privacy");
    expect(validRes.session).toBeNull();
  });

  it("handles password reset with honest local data explanation", async () => {
    const invalidRes = await authAdapter.requestPasswordReset("notanemail");
    expect(invalidRes.success).toBe(false);

    const validRes = await authAdapter.requestPasswordReset("user@example.com");
    expect(validRes.success).toBe(true);
    expect(validRes.message).toContain("stored locally");
  });

  it("returns null session in default local mode", async () => {
    const session = await authAdapter.getSession();
    expect(session).toBeNull();
  });
});
