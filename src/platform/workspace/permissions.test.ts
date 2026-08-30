import { describe, expect, it } from "vitest";
import { can, navigationFor } from "./permissions";

describe("permissions", () => {
  it("keeps financial exports available to accountants without user management", () => {
    expect(can("accountant", "export_financials")).toBe(true);
    expect(can("accountant", "manage_users")).toBe(false);
  });

  it("limits employees to their own payroll portal", () => {
    expect(can("employee", "read_own_payroll")).toBe(true);
    expect(can("employee", "read_financial_dashboard")).toBe(false);
    expect(navigationFor("employee")).toEqual(["loonstroken"]);
  });

  it("reserves the admin center for owners and platform admins", () => {
    expect(navigationFor("owner")).toContain("admin");
    expect(navigationFor("manager")).not.toContain("admin");
  });
});
