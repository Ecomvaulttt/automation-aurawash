import { authorizeOrganizationAdmin, safeApiError } from "../../server/supabase-admin.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") return safeApiError(response, 405, "method_not_allowed");
  const organizationId = String(request.query?.organizationId ?? "").trim();
  let authorization;
  try {
    authorization = await authorizeOrganizationAdmin(request, organizationId);
  } catch {
    return safeApiError(response, 503, "platform_not_configured");
  }
  if (!authorization.ok) return safeApiError(response, authorization.status, authorization.code);
  const { data, error } = await authorization.service
    .from("integrations")
    .select("provider, display_name, status, last_sync_at, last_test_at, last_error_code, retry_count")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (error) return safeApiError(response, 500, "connector_status_unavailable");
  return response.status(200).json({ ok: true, integrations: data ?? [] });
}
