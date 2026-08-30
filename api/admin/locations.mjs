import { authorizeOrganizationAdmin, safeApiError } from "../../server/supabase-admin.mjs";

function string(value, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function audit(service, organizationId, userId, action, entityId, data = {}) {
  await service.from("audit_events").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    action,
    entity_type: "location",
    entity_id: entityId,
    after_data: data,
  });
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "DELETE"].includes(request.method)) return safeApiError(response, 405, "method_not_allowed");
  const input = request.method === "GET" ? request.query ?? {} : request.body ?? {};
  const organizationId = string(input.organizationId, 36);
  if (!isUuid(organizationId)) return safeApiError(response, 400, "invalid_organization");
  let authorization;
  try {
    authorization = await authorizeOrganizationAdmin(request, organizationId);
  } catch {
    return safeApiError(response, 503, "platform_not_configured");
  }
  if (!authorization.ok) return safeApiError(response, authorization.status, authorization.code);
  const { service, user } = authorization;

  if (request.method === "GET") {
    const { data, error } = await service.from("locations")
      .select("id, name, code, active")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) return safeApiError(response, 500, "locations_unavailable");
    return response.status(200).json({ ok: true, locations: data ?? [] });
  }

  if (request.method === "POST") {
    const name = string(input.name);
    const code = string(input.code, 12).toUpperCase();
    if (name.length < 2 || code.length < 2) return safeApiError(response, 400, "invalid_location");
    const { data, error } = await service.from("locations").insert({ organization_id: organizationId, name, code, active: true }).select("id, name, code, active").single();
    if (error) return safeApiError(response, 409, "location_create_failed");
    await audit(service, organizationId, user.id, "location.created", data.id, { name, code });
    return response.status(201).json({ ok: true, location: data });
  }

  const locationId = string(input.locationId, 36);
  const reason = string(input.reason, 500);
  if (!isUuid(locationId) || reason.length < 5) return safeApiError(response, 400, "invalid_location_removal");
  const { count } = await service.from("locations").select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId).eq("active", true).is("deleted_at", null);
  if ((count ?? 0) <= 1) return safeApiError(response, 409, "last_location_required");
  const { error } = await service.from("locations").update({ active: false, deleted_at: new Date().toISOString() }).eq("id", locationId).eq("organization_id", organizationId);
  if (error) return safeApiError(response, 500, "location_remove_failed");
  await audit(service, organizationId, user.id, "location.removed", locationId, { reason });
  return response.status(200).json({ ok: true });
}
