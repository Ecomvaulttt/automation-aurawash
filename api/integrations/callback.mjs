import { createServiceClient } from "../../server/supabase-admin.mjs";
import { callbackUrl, encryptTokenPayload, exchangeAuthorizationCode, providerConfig, verifyOAuthState } from "../../server/integration-oauth.mjs";

function redirect(response, status) {
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? "/";
  response.setHeader("Cache-Control", "no-store");
  return response.redirect(302, `${base}/?integration=${encodeURIComponent(status)}`);
}

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).end();
  const code = String(request.query?.code ?? "");
  const stateValue = String(request.query?.state ?? "");
  if (!code || !stateValue) return redirect(response, "failed");

  try {
    const state = verifyOAuthState(stateValue);
    const config = providerConfig(state.provider);
    const tokenPayload = await exchangeAuthorizationCode(state.provider, code);
    const service = createServiceClient();
    const scopeQuery = service.from("integrations").select("id").eq("organization_id", state.organizationId).eq("provider", state.provider).is("deleted_at", null);
    const { data: existing } = state.locationId
      ? await scopeQuery.eq("location_id", state.locationId).maybeSingle()
      : await scopeQuery.is("location_id", null).maybeSingle();
    const integrationValues = {
      organization_id: state.organizationId,
      location_id: state.locationId,
      provider: state.provider,
      display_name: config.label,
      status: "connected",
      scopes: config.scopes,
      configuration: { redirect_uri: callbackUrl() },
      last_test_at: new Date().toISOString(),
      last_error_code: null,
      retry_count: 0,
    };
    const integrationResult = existing
      ? await service.from("integrations").update(integrationValues).eq("id", existing.id).select("id").single()
      : await service.from("integrations").insert(integrationValues).select("id").single();
    if (integrationResult.error) throw new Error("Integration save failed");

    const encryptedPayload = encryptTokenPayload(tokenPayload);
    const { data: existingSecret } = await service.from("integration_secrets").select("id").eq("integration_id", integrationResult.data.id).is("deleted_at", null).maybeSingle();
    const secretResult = existingSecret
      ? await service.from("integration_secrets").update({ encrypted_payload: encryptedPayload, key_version: 1 }).eq("id", existingSecret.id)
      : await service.from("integration_secrets").insert({ integration_id: integrationResult.data.id, encrypted_payload: encryptedPayload, key_version: 1 });
    if (secretResult.error) throw new Error("Secret save failed");

    await service.from("audit_events").insert({
      organization_id: state.organizationId,
      location_id: state.locationId,
      actor_user_id: state.userId,
      action: "integration.connected",
      entity_type: "integration",
      entity_id: integrationResult.data.id,
      after_data: { provider: state.provider, scopes: config.scopes },
    });
    return redirect(response, "connected");
  } catch {
    return redirect(response, "failed");
  }
}
