import { AppRole } from "../types";

export type Permission =
  | "read_financial_dashboard"
  | "manage_financials"
  | "export_financials"
  | "read_payroll"
  | "read_own_payroll"
  | "manage_payroll"
  | "manage_users"
  | "manage_integrations"
  | "manage_security"
  | "view_audit_log";

const permissions: Record<AppRole, ReadonlySet<Permission>> = {
  ecomvault_superadmin: new Set([
    "read_financial_dashboard",
    "manage_financials",
    "export_financials",
    "read_payroll",
    "manage_payroll",
    "manage_users",
    "manage_integrations",
    "manage_security",
    "view_audit_log",
  ]),
  owner: new Set([
    "read_financial_dashboard",
    "manage_financials",
    "export_financials",
    "read_payroll",
    "manage_payroll",
    "manage_users",
    "manage_integrations",
    "manage_security",
    "view_audit_log",
  ]),
  manager: new Set([
    "read_financial_dashboard",
    "manage_financials",
    "export_financials",
    "read_payroll",
    "manage_payroll",
    "manage_integrations",
  ]),
  accountant: new Set([
    "read_financial_dashboard",
    "export_financials",
    "read_payroll",
    "view_audit_log",
  ]),
  employee: new Set(["read_own_payroll"]),
};

export function can(role: AppRole, permission: Permission): boolean {
  return permissions[role].has(permission);
}

export function navigationFor(role: AppRole): string[] {
  if (role === "employee") return ["loonstroken"];
  if (role === "accountant") return ["overzicht", "loonstroken", "instanties", "facturen"];
  if (role === "manager") return ["onboarding", "overzicht", "loonstroken", "instanties", "facturen", "automation", "email"];
  return ["onboarding", "overzicht", "loonstroken", "instanties", "facturen", "automation", "email", "admin"];
}
