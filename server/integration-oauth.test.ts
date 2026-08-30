import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAuthorizationUrl, createOAuthState, decryptTokenPayload, encryptTokenPayload, tokenNeedsRefresh, verifyOAuthState } from "./integration-oauth.mjs";

describe("integration OAuth security", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-key-that-is-long-enough-for-security";
    process.env.APP_URL = "https://finance.example.com";
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.MICROSOFT_CLIENT_ID = "microsoft-client";
    process.env.MICROSOFT_CLIENT_SECRET = "microsoft-secret";
  });
  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.APP_URL;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
  });

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

  it("requests read and send scopes for both supported inbox providers", () => {
    const google = new URL(buildAuthorizationUrl("google", "signed-state"));
    const microsoft = new URL(buildAuthorizationUrl("microsoft", "signed-state"));
    expect(google.searchParams.get("scope")).toContain("gmail.readonly");
    expect(google.searchParams.get("scope")).toContain("gmail.send");
    expect(microsoft.searchParams.get("scope")).toContain("Mail.Read");
    expect(microsoft.searchParams.get("scope")).toContain("Mail.Send");
    expect(google.searchParams.get("redirect_uri")).toBe("https://finance.example.com/api/integrations/callback");
  });

  it("refreshes tokens only inside the one-minute expiry safety window", () => {
    const storedAt = Date.UTC(2026, 7, 31, 0, 0, 0);
    const token = { refresh_token: "refresh", expires_in: 3600, stored_at: storedAt };
    expect(tokenNeedsRefresh(token, storedAt + 30 * 60_000)).toBe(false);
    expect(tokenNeedsRefresh(token, storedAt + 59 * 60_000)).toBe(true);
    expect(tokenNeedsRefresh({ access_token: "static" }, storedAt + 10_000)).toBe(false);
  });
});
