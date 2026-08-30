import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOAuthState, decryptTokenPayload, encryptTokenPayload, verifyOAuthState } from "./integration-oauth.mjs";

describe("integration OAuth security", () => {
  beforeEach(() => { process.env.TOKEN_ENCRYPTION_KEY = "test-key-that-is-long-enough-for-security"; });
  afterEach(() => { delete process.env.TOKEN_ENCRYPTION_KEY; });

  it("signs and verifies short-lived tenant state", () => {
    const state = createOAuthState({ provider: "google", organizationId: "org", userId: "user" }, 1_000);
    expect(verifyOAuthState(state, 2_000)).toMatchObject({ provider: "google", organizationId: "org", userId: "user" });
    expect(() => verifyOAuthState(state, 700_000)).toThrow("Expired state");
  });

  it("rejects modified state", () => {
    const state = createOAuthState({ provider: "slack", organizationId: "org", userId: "user" });
    expect(() => verifyOAuthState(`${state}x`)).toThrow("Invalid state");
  });

  it("encrypts provider tokens at rest", () => {
    const encrypted = encryptTokenPayload({ access_token: "provider-token", refresh_token: "refresh-token" });
    expect(encrypted).not.toContain("provider-token");
    expect(decryptTokenPayload(encrypted)).toEqual({ access_token: "provider-token", refresh_token: "refresh-token" });
  });
});
