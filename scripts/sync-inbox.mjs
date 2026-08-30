import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ImapFlow } from "imapflow";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "automation/inbox-documents.json");
const documentRoot = resolve(root, "automation/documents");

const required = ["IMAP_HOST", "IMAP_USER", "IMAP_PASS"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing inbox env vars: ${missing.join(", ")}`);
}

const invoiceTerms = ["factuur", "invoice", "nota", "betaling", "loonstrook", "salaris", "vaste lasten"];
const sinceDays = Number(process.env.INBOX_SINCE_DAYS || 45);
const mailbox = process.env.IMAP_MAILBOX || "INBOX";

function safeName(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function hash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function extractAmount(text) {
  const match = text.match(/(?:totaal|amount|bedrag|te betalen|saldo)[^\d]{0,24}(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/i);
  if (!match) return 0;
  return Number(match[1].replace(/\./g, "").replace(",", "."));
}

function extractDate(text) {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const dutch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (!dutch) return "";
  const [, day, month, year] = dutch;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function classify(subject, fileName, text) {
  const haystack = `${subject} ${fileName} ${text}`.toLowerCase();
  if (haystack.includes("loonstrook") || haystack.includes("salaris")) return "loonstrook";
  if (haystack.includes("vaste last") || haystack.includes("abonnement")) return "vaste-last";
  if (haystack.includes("vf26") || haystack.includes("aurawash factuur")) return "te-ontvangen";
  return "te-betalen";
}

function extractInvoiceNumber(subject, fileName, text) {
  const haystack = `${subject} ${fileName} ${text}`;
  const match =
    haystack.match(/\b(VF\d{5,}|F\/\d{4}\/\d+|INV[- ]?\d+|20\d{2}[- ]?\d{3,}|\d{5,})\b/i) ||
    haystack.match(/factuurn(?:ummer|r)?[^\w]{0,12}([\w/-]+)/i);
  return match?.[1] ?? fileName.replace(extname(fileName), "");
}

function shouldHandle(subject, fileName, text) {
  const haystack = `${subject} ${fileName} ${text}`.toLowerCase();
  return invoiceTerms.some((term) => haystack.includes(term));
}

function findAttachments(node, attachments = []) {
  if (!node) return attachments;
  const disposition = String(node.disposition || "").toLowerCase();
  const fileName = node.parameters?.name || node.dispositionParameters?.filename;
  const looksLikeAttachment = disposition === "attachment" || Boolean(fileName);
  if (looksLikeAttachment && node.part) {
    attachments.push({
      part: node.part,
      fileName: fileName || `attachment-${node.part}.pdf`,
      mimeType: `${node.type || "application"}/${node.subtype || "octet-stream"}`.toLowerCase(),
    });
  }
  for (const child of node.childNodes || []) {
    findAttachments(child, attachments);
  }
  return attachments;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    return [];
  }
}

async function persistToPlatform(documents) {
  const requiredPlatform = ["VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ORGANIZATION_ID"];
  if (requiredPlatform.some((key) => !process.env[key])) return { stored: 0, skipped: documents.length };
  const client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const organizationId = process.env.ORGANIZATION_ID;
  const locationId = process.env.LOCATION_ID || null;
  let stored = 0;

  for (const document of documents) {
    const existing = await client
      .from("documents")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("source", "email")
      .eq("source_external_id", document.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing.data) continue;

    const documentId = randomUUID();
    const storagePath = `${organizationId}/${locationId || "all"}/${document.receivedAt.slice(0, 7)}/${documentId}-${safeName(document.fileName)}`;
    const file = await readFile(document.storagePath);
    const upload = await client.storage.from("documents").upload(storagePath, file, {
      contentType: document.mimeType,
      upsert: false,
    });
    if (upload.error) throw new Error(`Platform upload failed for ${document.id}`);

    const insertedDocument = await client.from("documents").insert({
      id: documentId,
      organization_id: organizationId,
      location_id: locationId,
      document_type: document.type,
      file_name: document.fileName,
      storage_path: storagePath,
      mime_type: document.mimeType,
      file_size: file.length,
      source: "email",
      source_external_id: document.id,
      status: "review_required",
      received_at: `${document.receivedAt}T00:00:00Z`,
      metadata: {
        subject: document.subject,
        sender: document.sender,
        sender_email: document.senderEmail,
        message_uid: document.messageUid,
        invoice_number: document.invoiceNumber,
        due_date: document.dueDate,
        amount: document.amount,
      },
    });
    if (insertedDocument.error) throw new Error(`Platform document insert failed for ${document.id}`);

    if (["te-betalen", "te-ontvangen", "vaste-last"].includes(document.type)) {
      const direction = document.type === "te-ontvangen" ? "receivable" : "payable";
      const existingInvoice = await client
        .from("invoices")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("direction", direction)
        .ilike("relation_name", document.relation)
        .ilike("invoice_number", document.invoiceNumber)
        .eq("amount", Number(document.amount || 0))
        .is("deleted_at", null)
        .maybeSingle();
      const values = {
        organization_id: organizationId,
        location_id: locationId,
        direction,
        relation_name: document.relation,
        invoice_number: document.invoiceNumber,
        amount: Number(document.amount || 0),
        invoice_date: document.receivedAt || null,
        due_date: document.dueDate || null,
        paid: "no",
        source_paid_field: "email:NEE",
        status: "review_required",
        priority: "normal",
        document_id: documentId,
        notes: "Automatisch uit inbox; handmatige controle vereist.",
        extraction: { subject: document.subject, file_name: document.fileName },
      };
      if (existingInvoice.data) await client.from("invoices").update(values).eq("id", existingInvoice.data.id);
      else await client.from("invoices").insert(values);
    }
    stored += 1;
  }

  return { stored, skipped: documents.length - stored };
}

async function main() {
  await mkdir(documentRoot, { recursive: true });

  const existing = await readExisting();
  const existingIds = new Set(existing.map((item) => item.id));
  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE !== "false",
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS,
    },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock(mailbox);
  const documents = [];

  try {
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    const uids = await client.search({ since }, { uid: true });

    for await (const message of client.fetch(uids, { uid: true, envelope: true, bodyStructure: true })) {
      const subject = message.envelope?.subject || "";
      const bodyText = "";
      const receivedAt = message.envelope?.date
        ? message.envelope.date.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const from = message.envelope?.from?.[0];

      for (const attachment of findAttachments(message.bodyStructure)) {
        const fileName = attachment.fileName || `attachment-${message.uid}.pdf`;
        if (!/\.(pdf|png|jpe?g)$/i.test(fileName)) continue;
        if (!shouldHandle(subject, fileName, bodyText)) continue;

        const id = hash(`${message.uid}-${fileName}-${attachment.part}`);
        if (existingIds.has(id)) continue;

        const month = receivedAt.slice(0, 7);
        const folder = join(documentRoot, month);
        await mkdir(folder, { recursive: true });

        const invoiceNumber = extractInvoiceNumber(subject, fileName, bodyText);
        const relation = from?.name || from?.address || "Onbekend";
        const targetName = safeName(`${receivedAt} ${relation} - ${invoiceNumber}${extname(fileName) || ".pdf"}`);
        const storagePath = join(folder, targetName);
        const downloaded = await client.download(message.uid, attachment.part, { uid: true });
        await writeFile(storagePath, await streamToBuffer(downloaded.content));

        const type = classify(subject, fileName, bodyText);
        documents.push({
          id,
          type,
          source: "email",
          direction: type === "te-betalen" || type === "vaste-last" ? "inkomend" : "uitgaand",
          relation,
          invoiceNumber,
          subject,
          sender: relation,
          senderEmail: from?.address,
          fileName: targetName,
          mimeType: attachment.mimeType || "application/pdf",
          receivedAt,
          dueDate: extractDate(bodyText),
          amount: extractAmount(bodyText),
          paid: "NEE",
          status: "Controle",
          category: type,
          extractedText: bodyText.slice(0, 1200),
          storagePath,
          linkedInvoice: invoiceNumber,
          messageUid: message.uid,
        });
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  const next = [...documents, ...existing];
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(next, null, 2)}\n`);
  const platform = await persistToPlatform(documents);
  console.log(`Inbox sync complete. New documents: ${documents.length}. Platform stored: ${platform.stored}. Total documents: ${next.length}.`);
}

await main();
