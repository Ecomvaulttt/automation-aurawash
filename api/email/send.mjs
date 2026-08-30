import { authorizeOrganizationRoles, safeApiError } from "../../server/supabase-admin.mjs";
import { connectedToken, sanitizeMailHeader, sendProviderMail } from "../../server/platform-automation.mjs";

function string(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return safeApiError(response, 405, "method_not_allowed");
  const organizationId = string(request.body?.organizationId, 36);
  const to = string(request.body?.to, 250).toLowerCase();
  const subject = sanitizeMailHeader(request.body?.subject, 240);
  const body = string(request.body?.body, 10_000);
  const documentId = string(request.body?.documentId, 36);
  if (!isUuid(organizationId) || !/^\S+@\S+\.\S+$/.test(to) || !subject || !body) {
    return safeApiError(response, 400, "invalid_email");
  }
  let authorization;
  try {
    authorization = await authorizeOrganizationRoles(request, organizationId, ["owner", "manager"]);
  } catch {
    return safeApiError(response, 503, "platform_not_configured");
  }
  if (!authorization.ok) return safeApiError(response, authorization.status, authorization.code);
  const { data: integrations } = await authorization.service.from("integrations")
    .select("id, provider")
    .eq("organization_id", organizationId)
    .in("provider", ["google", "microsoft"])
    .eq("status", "connected")
    .is("deleted_at", null)
    .limit(1);
  const integration = integrations?.[0];
  if (!integration) return safeApiError(response, 409, "email_connector_required");
  try {
    let attachment = null;
    if (documentId) {
      if (!isUuid(documentId)) return safeApiError(response, 400, "invalid_attachment");
      const { data: document } = await authorization.service.from("documents")
        .select("file_name, storage_path, mime_type, file_size")
        .eq("id", documentId).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle();
      if (!document || Number(document.file_size) > 15 * 1024 * 1024) return safeApiError(response, 409, "attachment_unavailable");
      const downloaded = await authorization.service.storage.from("documents").download(document.storage_path);
      if (downloaded.error) return safeApiError(response, 409, "attachment_unavailable");
      attachment = { fileName: document.file_name, mimeType: document.mime_type, content: Buffer.from(await downloaded.data.arrayBuffer()) };
    }
    await sendProviderMail(integration.provider, await connectedToken(authorization.service, integration), to, subject, body, attachment);
    await authorization.service.from("audit_events").insert({
      organization_id: organizationId,
      actor_user_id: authorization.user.id,
      action: "email.sent",
      entity_type: "email",
      after_data: { recipient_domain: to.split("@")[1] || "", subject },
    });
    return response.status(200).json({ ok: true });
  } catch {
    return safeApiError(response, 502, "email_send_failed");
  }
}
