import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Ontbrekende configuratie: ${name}`);
  return value;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const url = required("VITE_SUPABASE_URL");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const ownerEmail = required("BOOTSTRAP_OWNER_EMAIL").toLowerCase();
const ownerName = required("BOOTSTRAP_OWNER_NAME");
const companyName = required("BOOTSTRAP_COMPANY_NAME");
const companySlug = process.env.BOOTSTRAP_COMPANY_SLUG?.trim() || slugify(companyName);
const locationName = process.env.BOOTSTRAP_LOCATION_NAME?.trim() || "Hoofdvestiging";
const appUrl = required("APP_URL").replace(/\/$/, "");
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const existingOrganization = await supabase
  .from("organizations")
  .select("id")
  .eq("slug", companySlug)
  .is("deleted_at", null)
  .maybeSingle();

let organizationId = existingOrganization.data?.id;
if (!organizationId) {
  const organization = await supabase.from("organizations").insert({
    name: companyName,
    slug: companySlug,
    status: "onboarding",
  }).select("id").single();
  if (organization.error) throw new Error("Organisatie kon niet worden aangemaakt.");
  organizationId = organization.data.id;
}

let location = await supabase
  .from("locations")
  .select("id")
  .eq("organization_id", organizationId)
  .eq("code", "HQ")
  .is("deleted_at", null)
  .maybeSingle();
if (!location.data) {
  location = await supabase.from("locations").insert({
    organization_id: organizationId,
    name: locationName,
    code: "HQ",
  }).select("id").single();
}
if (!location.data?.id) throw new Error("Vestiging kon niet worden aangemaakt.");

const users = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
let owner = users.data?.users.find((user) => user.email?.toLowerCase() === ownerEmail);
if (!owner) {
  const invitation = await supabase.auth.admin.inviteUserByEmail(ownerEmail, {
    data: { full_name: ownerName },
    redirectTo: `${appUrl}/`,
  });
  if (invitation.error || !invitation.data.user) throw new Error("Eigenaar kon niet worden uitgenodigd.");
  owner = invitation.data.user;
}

await supabase.from("profiles").upsert({ id: owner.id, full_name: ownerName, email: ownerEmail }, { onConflict: "id" });
const existingMembership = await supabase
  .from("memberships")
  .select("id")
  .eq("user_id", owner.id)
  .eq("organization_id", organizationId)
  .is("deleted_at", null)
  .maybeSingle();
if (existingMembership.data) {
  await supabase.from("memberships").update({ role: "owner", status: "active", location_id: null }).eq("id", existingMembership.data.id);
} else {
  await supabase.from("memberships").insert({
    user_id: owner.id,
    organization_id: organizationId,
    location_id: null,
    role: "owner",
    status: "active",
    activated_at: new Date().toISOString(),
  });
}

await supabase.from("organization_settings").upsert({
  organization_id: organizationId,
  admin_email: ownerEmail,
  payable_reminder_days: 5,
  receivable_reminder_days: 3,
  auto_customer_email: false,
}, { onConflict: "organization_id" });

await supabase.from("onboarding_progress").upsert({
  organization_id: organizationId,
  current_step: "company",
  completed_steps: ["company", "locations", "users"],
  status: "in_progress",
}, { onConflict: "organization_id" });

for (const connector of [
  ["google", "Google Workspace"],
  ["microsoft", "Microsoft 365"],
  ["slack", "Slack"],
  ["bank", "Bankbestand"],
]) {
  const existing = await supabase.from("integrations").select("id").eq("organization_id", organizationId).eq("provider", connector[0]).is("location_id", null).is("deleted_at", null).maybeSingle();
  if (!existing.data) {
    await supabase.from("integrations").insert({
      organization_id: organizationId,
      provider: connector[0],
      display_name: connector[1],
      status: "not_configured",
    });
  }
}

console.log(`Klaar: ${companyName} is aangemaakt en de eigenaar is uitgenodigd.`);
