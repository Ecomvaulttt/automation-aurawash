import { createHash, randomUUID } from "node:crypto";
import { decryptTokenPayload, encryptTokenPayload, refreshAuthorizationToken, tokenNeedsRefresh } from "./integration-oauth.mjs";

const supportedFiles = /\.(pdf|png|jpe?g)$/i;

function safeName(value) {
  return String(value || "document.pdf").normalize("NFKD").replace(/[^a-zA-Z0-9._ -]/g, "").replace(/\s+/g, "-").slice(0, 120);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function classifyDocument(subject, fileName) {
  const value = `${subject} ${fileName}`.toLowerCase();
  if (/loonstrook|salaris|payroll/.test(value)) return "loonstrook";
  if (/vaste.last|abonnement|subscription/.test(value)) return "vaste-last";
  if (/vf\d{4,}|verkoopfactuur|sales.invoice/.test(value)) return "te-ontvangen";
  return "te-betalen";
}

export function extractInvoiceNumber(subject, fileName) {
  const value = `${subject} ${fileName}`;
  return value.match(/\b(VF\d{5,}|F\/?\d{4}\/?\d+|INV[- ]?\d+|20\d{2}[- ]?\d{3,}|\d{5,})\b/i)?.[1]
    ?? fileName.replace(/\.[^.]+$/, "");
}

function decodeBase64Url(value) {
  return Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function gmailHeaders(message) {
  return new Map((message.payload?.headers ?? []).map((header) => [String(header.name).toLowerCase(), String(header.value)]));
}

function gmailAttachmentParts(part, output = []) {
  if (!part) return output;
  if (part.filename && part.body?.attachmentId && supportedFiles.test(part.filename)) output.push(part);
  for (const child of part.parts ?? []) gmailAttachmentParts(child, output);
  return output;
}

async function gmailDocuments(token, sinceDays) {
  const query = encodeURIComponent(`has:attachment newer_than:${sinceDays}d (factuur OR invoice OR loonstrook OR salaris OR abonnement)`);
  const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${query}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!listResponse.ok) throw new Error("gmail_list_failed");
  const list = await listResponse.json();
  const documents = [];
  for (const item of list.messages ?? []) {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!response.ok) continue;
    const message = await response.json();
    const headers = gmailHeaders(message);
    const subject = headers.get("subject") || "";
    const sender = headers.get("from") || "Onbekend";
    for (const part of gmailAttachmentParts(message.payload)) {
      const attachmentResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}/attachments/${part.body.attachmentId}`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!attachmentResponse.ok) continue;
      const attachment = await attachmentResponse.json();
      documents.push({
        externalId: `google:${item.id}:${part.body.attachmentId}`,
        fileName: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        content: decodeBase64Url(attachment.data),
        subject,
        sender,
        receivedAt: new Date(Number(message.internalDate || Date.now())).toISOString(),
      });
    }
  }
  return documents;
}

async function microsoftDocuments(token, sinceDays) {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const query = new URL("https://graph.microsoft.com/v1.0/me/messages");
  query.searchParams.set("$filter", `hasAttachments eq true and receivedDateTime ge ${since}`);
  query.searchParams.set("$select", "id,subject,from,receivedDateTime");
  query.searchParams.set("$top", "50");
  const response = await fetch(query, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!response.ok) throw new Error("microsoft_list_failed");
  const payload = await response.json();
  const documents = [];
  for (const message of payload.value ?? []) {
    const attachmentResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${message.id}/attachments`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!attachmentResponse.ok) continue;
    const attachments = await attachmentResponse.json();
    for (const attachment of attachments.value ?? []) {
      if (!attachment.contentBytes || !supportedFiles.test(attachment.name || "")) continue;
      documents.push({
        externalId: `microsoft:${message.id}:${attachment.id}`,
        fileName: attachment.name,
        mimeType: attachment.contentType || "application/octet-stream",
        content: Buffer.from(attachment.contentBytes, "base64"),
        subject: message.subject || "",
        sender: message.from?.emailAddress?.name || message.from?.emailAddress?.address || "Onbekend",
        receivedAt: message.receivedDateTime || new Date().toISOString(),
      });
    }
  }
  return documents;
}

export async function connectedToken(service, integration) {
  const { data: secret } = await service.from("integration_secrets").select("id, encrypted_payload").eq("integration_id", integration.id).is("deleted_at", null).maybeSingle();
  if (!secret) throw new Error("integration_secret_missing");
  let token = decryptTokenPayload(secret.encrypted_payload);
  if (tokenNeedsRefresh(token)) {
    token = await refreshAuthorizationToken(integration.provider, token);
    await service.from("integration_secrets").update({ encrypted_payload: encryptTokenPayload(token), key_version: 1 }).eq("id", secret.id);
  }
  return token;
}

async function persistDocument(service, integration, document) {
  const sourceExternalId = hash(document.externalId);
  const { data: existing } = await service.from("documents").select("id").eq("organization_id", integration.organization_id)
    .eq("source", "email").eq("source_external_id", sourceExternalId).is("deleted_at", null).maybeSingle();
  if (existing) return false;
  const id = randomUUID();
  const month = document.receivedAt.slice(0, 7);
  const storagePath = `${integration.organization_id}/${integration.location_id || "all"}/${month}/${id}-${safeName(document.fileName)}`;
  const uploaded = await service.storage.from("documents").upload(storagePath, document.content, { contentType: document.mimeType, upsert: false });
  if (uploaded.error) throw new Error("storage_upload_failed");
  const type = classifyDocument(document.subject, document.fileName);
  const invoiceNumber = extractInvoiceNumber(document.subject, document.fileName);
  const inserted = await service.from("documents").insert({
    id,
    organization_id: integration.organization_id,
    location_id: integration.location_id,
    document_type: type === "loonstrook" ? "payroll" : type,
    file_name: document.fileName,
    storage_path: storagePath,
    mime_type: document.mimeType,
    file_size: document.content.length,
    source: "email",
    source_external_id: sourceExternalId,
    status: "review_required",
    received_at: document.receivedAt,
    metadata: { subject: document.subject, sender: document.sender, invoice_number: invoiceNumber },
  });
  if (inserted.error) throw new Error("document_insert_failed");
  if (type !== "loonstrook") {
    const direction = type === "te-ontvangen" ? "receivable" : "payable";
    const { data: existingInvoice } = await service.from("invoices").select("id").eq("organization_id", integration.organization_id)
      .eq("direction", direction).ilike("relation_name", document.sender).ilike("invoice_number", invoiceNumber).eq("amount", 0).is("deleted_at", null).maybeSingle();
    const values = {
      organization_id: integration.organization_id,
      location_id: integration.location_id,
      direction,
      relation_name: document.sender,
      invoice_number: invoiceNumber,
      amount: 0,
      paid: "no",
      source_paid_field: "email:NEE",
      status: "review_required",
      priority: "normal",
      document_id: id,
      notes: "Automatisch uit gekoppelde inbox. Bedrag en vervaldatum controleren.",
      extraction: { subject: document.subject, file_name: document.fileName },
    };
    if (existingInvoice) await service.from("invoices").update(values).eq("id", existingInvoice.id);
    else await service.from("invoices").insert(values);
  }
  return true;
}

async function sendSlack(token, text) {
  const webhook = token?.incoming_webhook?.url;
  if (!webhook) return false;
  const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  if (!response.ok) throw new Error("slack_send_failed");
  return true;
}

function mailText(invoice, companyName) {
  return `Hi,\n\nFactuur ${invoice.invoice_number} van EUR ${Number(invoice.amount).toFixed(2)} staat bij ons nog open. Wil je deze uiterlijk ${invoice.due_date} overboeken?\n\nAls de betaling al gedaan is, mag je dit bericht negeren.\n\nGroet,\n${companyName}`;
}

export async function sendProviderMail(provider, token, to, subject, content, attachment = null) {
  if (provider === "google") {
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
    let message = `To: ${to}\r\nSubject: ${encodedSubject}\r\nMIME-Version: 1.0\r\n`;
    if (attachment) {
      const boundary = `ecomvault-${randomUUID()}`;
      const attachmentData = attachment.content.toString("base64").replace(/(.{76})/g, "$1\r\n");
      message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${content}\r\n--${boundary}\r\nContent-Type: ${attachment.mimeType}; name="${safeName(attachment.fileName)}"\r\nContent-Disposition: attachment; filename="${safeName(attachment.fileName)}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${attachmentData}\r\n--${boundary}--`;
    } else message += `Content-Type: text/plain; charset=utf-8\r\n\r\n${content}`;
    const raw = Buffer.from(message).toString("base64url");
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }),
    });
    if (!response.ok) throw new Error("gmail_send_failed");
    return;
  }
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      subject,
      body: { contentType: "Text", content },
      toRecipients: [{ emailAddress: { address: to } }],
      ...(attachment ? { attachments: [{
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: safeName(attachment.fileName),
        contentType: attachment.mimeType,
        contentBytes: attachment.content.toString("base64"),
      }] } : {}),
    } }),
  });
  if (!response.ok) throw new Error("microsoft_send_failed");
}

async function reminderAlreadySent(service, invoiceId, channel) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await service.from("audit_events").select("id", { count: "exact", head: true })
    .eq("entity_id", invoiceId).eq("action", `reminder.${channel}.sent`).gte("created_at", since.toISOString()).is("deleted_at", null);
  return (count ?? 0) > 0;
}

async function runReminders(service, organization, settings, integrations) {
  const horizon = Math.max(settings?.payable_reminder_days ?? 5, settings?.receivable_reminder_days ?? 3);
  const horizonDate = new Date(Date.now() + horizon * 86_400_000).toISOString().slice(0, 10);
  const { data: invoices } = await service.from("invoices").select("id, direction, relation_name, invoice_number, amount, due_date, extraction")
    .eq("organization_id", organization.id).eq("paid", "no").lte("due_date", horizonDate).is("deleted_at", null);
  const slackIntegration = integrations.find((item) => item.provider === "slack" && item.status === "connected");
  const mailIntegration = integrations.find((item) => ["google", "microsoft"].includes(item.provider) && item.status === "connected");
  const tokenCache = new Map();
  const tokenFor = async (integration) => {
    if (!tokenCache.has(integration.id)) tokenCache.set(integration.id, await connectedToken(service, integration));
    return tokenCache.get(integration.id);
  };
  let sent = 0;
  for (const invoice of invoices ?? []) {
    const days = Math.ceil((new Date(`${invoice.due_date}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
    const threshold = invoice.direction === "receivable" ? settings.receivable_reminder_days : settings.payable_reminder_days;
    if (days > threshold) continue;
    if (slackIntegration && !(await reminderAlreadySent(service, invoice.id, "slack"))) {
      const text = `*${organization.name} factuuractie*\n${invoice.direction === "receivable" ? "Te ontvangen" : "Te betalen"}: ${invoice.relation_name}\nFactuur: ${invoice.invoice_number}\nBedrag: EUR ${Number(invoice.amount).toFixed(2)}\nVervaldatum: ${invoice.due_date}\nStatus: ${days < 0 ? `${Math.abs(days)} dagen te laat` : `${days} dagen resterend`}`;
      if (await sendSlack(await tokenFor(slackIntegration), text)) {
        await service.from("audit_events").insert({ organization_id: organization.id, action: "reminder.slack.sent", entity_type: "invoice", entity_id: invoice.id, after_data: { days } });
        sent += 1;
      }
    }
    const email = invoice.extraction?.customer_email;
    if (invoice.direction === "receivable" && settings.auto_customer_email && email && mailIntegration && !(await reminderAlreadySent(service, invoice.id, "email"))) {
      await sendProviderMail(mailIntegration.provider, await tokenFor(mailIntegration), email, `Herinnering factuur ${invoice.invoice_number}`, mailText(invoice, organization.name));
      await service.from("audit_events").insert({ organization_id: organization.id, action: "reminder.email.sent", entity_type: "invoice", entity_id: invoice.id, after_data: { recipient_domain: String(email).split("@")[1] || "" } });
      sent += 1;
    }
  }
  return sent;
}

export async function runPlatformAutomation(service, options = {}) {
  const sinceDays = Number(options.sinceDays || 45);
  const { data: organizations, error } = await service.from("organizations").select("id, name").eq("status", "active").is("deleted_at", null);
  if (error) throw new Error("organizations_unavailable");
  const result = { organizations: 0, documents: 0, reminders: 0, failures: 0 };
  for (const organization of organizations ?? []) {
    const [{ data: integrations }, { data: settings }] = await Promise.all([
      service.from("integrations").select("id, organization_id, location_id, provider, status").eq("organization_id", organization.id).eq("status", "connected").is("deleted_at", null),
      service.from("organization_settings").select("payable_reminder_days, receivable_reminder_days, auto_customer_email").eq("organization_id", organization.id).is("deleted_at", null).maybeSingle(),
    ]);
    result.organizations += 1;
    for (const integration of (integrations ?? []).filter((item) => ["google", "microsoft"].includes(item.provider))) {
      const runKey = `${new Date().toISOString().slice(0, 13)}:${integration.id}:inbox`;
      const { data: existingRun } = await service.from("automation_runs").select("id, status").eq("organization_id", organization.id).eq("idempotency_key", runKey).is("deleted_at", null).maybeSingle();
      if (existingRun?.status === "succeeded") continue;
      const runValues = { organization_id: organization.id, location_id: integration.location_id, integration_id: integration.id, run_type: "inbox_sync", status: "running", idempotency_key: runKey, started_at: new Date().toISOString() };
      const runResult = existingRun ? await service.from("automation_runs").update(runValues).eq("id", existingRun.id).select("id").single() : await service.from("automation_runs").insert(runValues).select("id").single();
      try {
        const token = await connectedToken(service, integration);
        const documents = integration.provider === "google" ? await gmailDocuments(token, sinceDays) : await microsoftDocuments(token, sinceDays);
        let stored = 0;
        for (const document of documents) if (await persistDocument(service, integration, document)) stored += 1;
        await service.from("automation_runs").update({ status: "succeeded", processed_count: documents.length, success_count: stored, finished_at: new Date().toISOString() }).eq("id", runResult.data.id);
        await service.from("integrations").update({ last_sync_at: new Date().toISOString(), last_error_code: null, retry_count: 0 }).eq("id", integration.id);
        result.documents += stored;
      } catch (automationError) {
        const code = automationError instanceof Error ? automationError.message.slice(0, 80) : "automation_failed";
        await service.from("automation_runs").update({ status: "failed", failed_count: 1, last_error_code: code, finished_at: new Date().toISOString() }).eq("id", runResult.data.id);
        await service.from("integrations").update({ status: "attention", last_error_code: code, retry_count: 1 }).eq("id", integration.id);
        result.failures += 1;
      }
    }
    result.reminders += await runReminders(service, organization, settings ?? { payable_reminder_days: 5, receivable_reminder_days: 3, auto_customer_email: false }, integrations ?? []);
  }
  return result;
}
