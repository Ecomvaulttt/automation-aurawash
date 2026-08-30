import { authorizeOrganizationAdmin, safeApiError } from "../../server/supabase-admin.mjs";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") return safeApiError(response, 405, "method_not_allowed");
  const organizationId = String(request.query?.organizationId ?? "").trim();
  if (!isUuid(organizationId)) return safeApiError(response, 400, "invalid_organization");
  let authorization;
  try {
    authorization = await authorizeOrganizationAdmin(request, organizationId);
  } catch {
    return safeApiError(response, 503, "platform_not_configured");
  }
  if (!authorization.ok) return safeApiError(response, authorization.status, authorization.code);
  const { data, error } = await authorization.service.from("audit_events")
    .select("id, action, entity_type, actor_user_id, reason, created_at")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) return safeApiError(response, 500, "audit_unavailable");
  const actorIds = Array.from(new Set((data ?? []).map((event) => event.actor_user_id).filter(Boolean)));
  const { data: profiles } = actorIds.length
    ? await authorization.service.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return response.status(200).json({
    ok: true,
    events: (data ?? []).map((event) => ({ ...event, actor: profileById.get(event.actor_user_id) ?? null })),
  });
}
