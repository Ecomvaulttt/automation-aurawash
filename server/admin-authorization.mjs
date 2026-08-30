export const ADMIN_ROLES = new Set(["owner", "ecomvault_superadmin"]);
export const ASSIGNABLE_ROLES = new Set(["owner", "manager", "accountant", "employee"]);

export function isAdminRole(role) {
  return ADMIN_ROLES.has(role);
}

export function isAssignableRole(role) {
  return ASSIGNABLE_ROLES.has(role);
}

export function readBearerToken(request) {
  const header = request.headers?.authorization ?? request.headers?.Authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export function readAssuranceLevel(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).aal ?? null;
  } catch {
    return null;
  }
}
