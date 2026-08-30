import { describe, expect, it } from "vitest";
import { isAdminRole, isAssignableRole, readAssuranceLevel, readBearerToken } from "./admin-authorization.mjs";

function token(payload: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

describe("admin authorization helpers", () => {
  it("allows only owners and EcomVault superadmins to manage users", () => {
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("ecomvault_superadmin")).toBe(true);
    expect(isAdminRole("accountant")).toBe(false);
  });

  it("never lets a tenant assign the platform superadmin role", () => {
    expect(isAssignableRole("manager")).toBe(true);
    expect(isAssignableRole("ecomvault_superadmin")).toBe(false);
  });

  it("reads bearer and aal claims without exposing the token", () => {
    const accessToken = token({ sub: "user", aal: "aal2" });
    expect(readBearerToken({ headers: { authorization: `Bearer ${accessToken}` } })).toBe(accessToken);
    expect(readAssuranceLevel(accessToken)).toBe("aal2");
  });
});
