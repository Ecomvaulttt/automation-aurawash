import { authorizeOrganizationAdmin, safeApiError } from "../../server/supabase-admin.mjs";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return safeApiError(response, 405, "method_not_allowed");
  const organizationId = String(request.body?.organizationId ?? "").trim();
  if (!isUuid(organizationId)) return safeApiError(response, 400, "invalid_organization");
  let authorization;
  try {
    authorization = await authorizeOrganizationAdmin(request, organizationId);
  } catch {
    return safeApiError(response, 503, "platform_not_configured");
  }
  if (!authorization.ok) return safeApiError(response, authorization.status, authorization.code);
  const { service, user } = authorization;
  const [organization, locations, owners, integrations, settings, bankDocuments] = await Promise.all([
    service.from("organizations").select("name, sector").eq("id", organizationId).is("deleted_at", null).maybeSingle(),
    service.from("locations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("active", true).is("deleted_at", null),
    service.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("role", "owner").eq("status", "active").is("deleted_at", null),
    service.from("integrations").select("provider, status").eq("organization_id", organizationId).eq("status", "connected").is("deleted_at", null),
    service.from("organization_settings").select("bookkeeper_email").eq("organization_id", organizationId).is("deleted_at", null).maybeSingle(),
    service.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("document_type", "bank_statement").is("deleted_at", null),
  ]);
  const connected = new Set((integrations.data ?? []).map((item) => item.provider));
  const blockers = [];
  if (!organization.data?.name || !organization.data?.sector) blockers.push("Bedrijfsprofiel");
  if ((locations.count ?? 0) < 1) blockers.push("Vestiging");
  if ((owners.count ?? 0) < 1) blockers.push("Eigenaar");
  if (!connected.has("google") && !connected.has("microsoft")) blockers.push("E-mailkoppeling");
  if (!connected.has("slack")) blockers.push("Slack");
  if ((bankDocuments.count ?? 0) < 1) blockers.push("Bankimport");
  if (!settings.data?.bookkeeper_email) blockers.push("Boekhouder e-mail");
  if (blockers.length) return response.status(409).json({ ok: false, error: "launch_blocked", blockers });

  const now = new Date().toISOString();
  const [organizationUpdate, onboardingUpdate] = await Promise.all([
    service.from("organizations").update({ status: "active" }).eq("id", organizationId),
    service.from("onboarding_progress").upsert({
      organization_id: organizationId,
      current_step: "launch",
      completed_steps: ["company", "locations", "users", "security", "email", "slack", "bank", "accountant", "rules", "launch"],
      status: "launched",
      launched_at: now,
    }, { onConflict: "organization_id" }),
  ]);
  if (organizationUpdate.error || onboardingUpdate.error) return safeApiError(response, 500, "launch_failed");
  await service.from("audit_events").insert({ organization_id: organizationId, actor_user_id: user.id, action: "organization.launched", entity_type: "organization", entity_id: organizationId });
  return response.status(200).json({ ok: true, launchedAt: now });
}
