import { authorizeOrganizationAdmin, safeApiError } from "../../server/supabase-admin.mjs";
import { buildAuthorizationUrl, createOAuthState, providerConfig } from "../../server/integration-oauth.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return safeApiError(response, 405, "method_not_allowed");
  const organizationId = String(request.body?.organizationId ?? "").trim();
  const locationId = String(request.body?.locationId ?? "").trim() || null;
  const provider = String(request.body?.provider ?? "").trim();

  let authorization;
  try {
    providerConfig(provider);
    authorization = await authorizeOrganizationAdmin(request, organizationId);
  } catch {
    return safeApiError(response, 503, "connector_not_configured");
  }
  if (!authorization.ok) return safeApiError(response, authorization.status, authorization.code);

  const state = createOAuthState({
    provider,
    organizationId,
    locationId,
    userId: authorization.user.id,
  });
  return response.status(200).json({ ok: true, authorizationUrl: buildAuthorizationUrl(provider, state) });
}
