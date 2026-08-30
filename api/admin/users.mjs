import { isAssignableRole } from "../../server/admin-authorization.mjs";
import { authorizeOrganizationAdmin, safeApiError } from "../../server/supabase-admin.mjs";

function string(value, max = 250) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function audit(service, payload) {
  await service.from("audit_events").insert(payload);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return safeApiError(response, 405, "method_not_allowed");
  }

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
    const { data, error } = await service
      .from("memberships")
      .select("id, user_id, location_id, role, status, invited_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) return safeApiError(response, 500, "members_unavailable");
    const members = data ?? [];
    const userIds = Array.from(new Set(members.map((member) => member.user_id)));
    const locationIds = Array.from(new Set(members.map((member) => member.location_id).filter(Boolean)));
    const [{ data: profiles }, { data: locations }] = await Promise.all([
      userIds.length ? service.from("profiles").select("id, full_name, email").in("id", userIds) : Promise.resolve({ data: [] }),
      locationIds.length ? service.from("locations").select("id, name").in("id", locationIds) : Promise.resolve({ data: [] }),
    ]);
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const locationById = new Map((locations ?? []).map((location) => [location.id, location]));
    return response.status(200).json({
      ok: true,
      members: members.map((member) => ({
        ...member,
        profiles: profileById.get(member.user_id) ?? null,
        locations: member.location_id ? locationById.get(member.location_id) ?? null : null,
      })),
    });
  }

  if (request.method === "POST") {
    const email = string(input.email).toLowerCase();
    const name = string(input.name, 120);
    const role = string(input.role, 32);
    const locationId = string(input.locationId, 36) || null;
    if (!/^\S+@\S+\.\S+$/.test(email) || !name || !isAssignableRole(role)) {
      return safeApiError(response, 400, "invalid_invitation");
    }
    if (locationId && !isUuid(locationId)) return safeApiError(response, 400, "invalid_location");

    const redirectTo = `${process.env.APP_URL?.replace(/\/$/, "") ?? ""}/`;
    const invitation = await service.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
      redirectTo,
    });
    if (invitation.error || !invitation.data.user) return safeApiError(response, 409, "invitation_failed");

    const invitedUser = invitation.data.user;
    await service.from("profiles").upsert({ id: invitedUser.id, full_name: name, email }, { onConflict: "id" });
    const membership = await service.from("memberships").insert({
      user_id: invitedUser.id,
      organization_id: organizationId,
      location_id: locationId,
      role,
      status: "invited",
      invited_by: user.id,
    }).select("id, user_id, location_id, role, status").single();
    if (membership.error) return safeApiError(response, 409, "membership_failed");

    await audit(service, {
      organization_id: organizationId,
      actor_user_id: user.id,
      action: "membership.invited",
      entity_type: "membership",
      entity_id: membership.data.id,
      after_data: { email, role, location_id: locationId },
    });
    return response.status(201).json({ ok: true, member: membership.data });
  }

  const membershipId = string(input.membershipId, 36);
  if (!isUuid(membershipId)) return safeApiError(response, 400, "invalid_membership");
  const { data: target } = await service
    .from("memberships")
    .select("id, user_id, role, status")
    .eq("id", membershipId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!target) return safeApiError(response, 404, "membership_not_found");

  if (request.method === "PATCH") {
    const role = string(input.role, 32);
    const status = string(input.status, 32);
    if (!isAssignableRole(role) || !["invited", "active", "blocked"].includes(status)) {
      return safeApiError(response, 400, "invalid_membership_update");
    }
    const result = await service.from("memberships").update({ role, status }).eq("id", membershipId).select("id, role, status").single();
    if (result.error) return safeApiError(response, 500, "membership_update_failed");
    await audit(service, {
      organization_id: organizationId,
      actor_user_id: user.id,
      action: "membership.updated",
      entity_type: "membership",
      entity_id: membershipId,
      before_data: { role: target.role, status: target.status },
      after_data: { role, status },
    });
    return response.status(200).json({ ok: true, member: result.data });
  }

  const reason = string(input.reason, 500);
  if (reason.length < 5) return safeApiError(response, 400, "reason_required");
  if (target.user_id === user.id) return safeApiError(response, 409, "cannot_remove_self");
  if (target.role === "owner") {
    const { count } = await service
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("role", "owner")
      .eq("status", "active")
      .is("deleted_at", null);
    if ((count ?? 0) <= 1) return safeApiError(response, 409, "last_owner_required");
  }
  const result = await service.from("memberships").update({ status: "blocked", deleted_at: new Date().toISOString() }).eq("id", membershipId);
  if (result.error) return safeApiError(response, 500, "membership_remove_failed");
  await audit(service, {
    organization_id: organizationId,
    actor_user_id: user.id,
    action: "membership.removed",
    entity_type: "membership",
    entity_id: membershipId,
    before_data: { role: target.role, status: target.status },
    reason,
  });
  return response.status(200).json({ ok: true });
}
