import { createClient } from "@supabase/supabase-js";
import { readAssuranceLevel, readBearerToken } from "./admin-authorization.mjs";

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export function createServiceClient() {
  return createClient(
    requiredEnvironment("VITE_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function authorizeOrganizationAdmin(request, organizationId) {
  return authorizeOrganizationRoles(request, organizationId, ["owner"]);
}

export async function authorizeOrganizationRoles(request, organizationId, allowedRoles) {
  const token = readBearerToken(request);
  if (!token) return { ok: false, status: 401, code: "missing_session" };
  if (readAssuranceLevel(token) !== "aal2") return { ok: false, status: 403, code: "mfa_required" };

  const service = createServiceClient();
  const { data: userResult, error: userError } = await service.auth.getUser(token);
  const user = userResult?.user;
  if (userError || !user) return { ok: false, status: 401, code: "invalid_session" };

  const { data: profile } = await service
    .from("profiles")
    .select("platform_role, status")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (profile?.platform_role === "ecomvault_superadmin" && profile.status === "active") {
    return { ok: true, service, user, role: "ecomvault_superadmin" };
  }

  const { data: membership } = await service
    .from("memberships")
    .select("role, status")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (!membership || !allowedRoles.includes(membership.role)) {
    return { ok: false, status: 403, code: "insufficient_role" };
  }

  return { ok: true, service, user, role: membership.role };
}

export function safeApiError(response, status, code) {
  return response.status(status).json({ ok: false, error: code });
}
