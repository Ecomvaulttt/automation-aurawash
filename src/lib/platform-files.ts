import { getSupabaseClient } from "../platform/supabase";
import type { Workspace } from "../platform/types";
import type { Payable, Receivable } from "../data";

export type WorkspaceDocumentInput = {
  type: "te-betalen" | "te-ontvangen" | "loonstrook" | "vaste-last";
  relation: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  customerEmail?: string;
  period?: string;
  gross?: number;
  net?: number;
  approved?: boolean;
};

export type UploadedWorkspaceDocument = {
  id: string;
  storagePath: string;
  previewUrl?: string;
};

export async function uploadBankStatement(
  file: File,
  workspace: Workspace,
  userId: string | undefined,
  metadata: Record<string, unknown>,
) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is niet geconfigureerd.");
  const documentId = crypto.randomUUID();
  const month = new Date().toISOString().slice(0, 7);
  const storagePath = `${workspace.organizationId}/${workspace.locationId ?? "all"}/${month}/${documentId}-${safeFileName(file.name)}`;
  const upload = await client.storage.from("documents").upload(storagePath, file, {
    contentType: file.type || (file.name.toLowerCase().endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    upsert: false,
  });
  if (upload.error) throw upload.error;
  const inserted = await client.from("documents").insert({
    id: documentId,
    organization_id: workspace.organizationId,
    location_id: workspace.locationId,
    document_type: "bank_statement",
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type || "application/octet-stream",
    file_size: file.size,
    source: "upload",
    status: "approved",
    uploaded_by: userId ?? null,
    metadata,
  });
  if (inserted.error) {
    await client.storage.from("documents").remove([storagePath]);
    throw inserted.error;
  }
  return { id: documentId, storagePath };
}

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._ -]/g, "").replace(/\s+/g, "-").slice(0, 120);
}

function paidDatabaseValue(value: "JA" | "NEE" | "JA (termijn)") {
  if (value === "JA") return "yes";
  if (value === "JA (termijn)") return "installment";
  return "no";
}

export async function uploadWorkspaceDocument(
  file: File,
  workspace: Workspace,
  userId: string | undefined,
  input: WorkspaceDocumentInput,
): Promise<UploadedWorkspaceDocument> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is niet geconfigureerd.");
  const documentId = crypto.randomUUID();
  const month = new Date().toISOString().slice(0, 7);
  const storagePath = `${workspace.organizationId}/${workspace.locationId ?? "all"}/${month}/${documentId}-${safeFileName(file.name)}`;
  const upload = await client.storage.from("documents").upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const documentType = input.type === "loonstrook" ? "payroll" : input.type;
  const metadata = {
    subject: `${input.relation} ${input.invoiceNumber}`.trim(),
    sender: input.relation,
    customer_email: input.customerEmail ?? "",
    invoice_number: input.invoiceNumber,
    amount: input.amount,
    due_date: input.dueDate,
    period: input.period ?? "",
    gross: input.gross ?? 0,
    net: input.net ?? 0,
  };
  const inserted = await client.from("documents").insert({
    id: documentId,
    organization_id: workspace.organizationId,
    location_id: workspace.locationId,
    document_type: documentType,
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type || "application/octet-stream",
    file_size: file.size,
    source: "upload",
    status: input.approved ? "approved" : "review_required",
    uploaded_by: userId ?? null,
    metadata,
  });
  if (inserted.error) {
    await client.storage.from("documents").remove([storagePath]);
    throw inserted.error;
  }

  try {
    if (input.type === "loonstrook") {
      const employeeResult = await client
        .from("employees")
        .select("id")
        .eq("organization_id", workspace.organizationId)
        .ilike("full_name", input.relation)
        .is("deleted_at", null)
        .maybeSingle();
      let employeeId = employeeResult.data?.id as string | undefined;
      if (!employeeId) {
        const createdEmployee = await client.from("employees").insert({
          organization_id: workspace.organizationId,
          location_id: workspace.locationId,
          full_name: input.relation,
          status: "active",
          gross_monthly: input.gross ?? 0,
          net_monthly: input.net ?? 0,
        }).select("id").single();
        if (createdEmployee.error) throw createdEmployee.error;
        employeeId = createdEmployee.data.id;
      }
      const existingPayroll = await client.from("payroll_documents")
        .select("id")
        .eq("employee_id", employeeId)
        .eq("period", input.period ?? month)
        .is("deleted_at", null)
        .maybeSingle();
      const payrollValues = {
        organization_id: workspace.organizationId,
        location_id: workspace.locationId,
        employee_id: employeeId,
        document_id: documentId,
        period: input.period ?? month,
        gross: input.gross ?? 0,
        net: input.net ?? 0,
        status: input.approved ? "approved" : "review",
      };
      const payrollResult = existingPayroll.data?.id
        ? await client.from("payroll_documents").update(payrollValues).eq("id", existingPayroll.data.id)
        : await client.from("payroll_documents").insert(payrollValues);
      if (payrollResult.error) throw payrollResult.error;
    } else {
      const direction = input.type === "te-ontvangen" ? "receivable" : "payable";
      const existingInvoice = await client.from("invoices")
        .select("id")
        .eq("organization_id", workspace.organizationId)
        .eq("direction", direction)
        .ilike("relation_name", input.relation)
        .ilike("invoice_number", input.invoiceNumber)
        .eq("amount", input.amount)
        .is("deleted_at", null)
        .maybeSingle();
      const invoiceValues = {
        organization_id: workspace.organizationId,
        location_id: workspace.locationId,
        direction,
        relation_name: input.relation,
        invoice_number: input.invoiceNumber,
        amount: input.amount,
        due_date: input.dueDate || null,
        paid: paidDatabaseValue("NEE"),
        source_paid_field: "manual:NEE",
        status: input.approved ? "approved" : "review_required",
        priority: "normal",
        document_id: documentId,
        notes: input.type === "vaste-last" ? "Vaste last via handmatige upload" : "Handmatig geupload",
        extraction: metadata,
      };
      const invoiceResult = existingInvoice.data?.id
        ? await client.from("invoices").update(invoiceValues).eq("id", existingInvoice.data.id)
        : await client.from("invoices").insert(invoiceValues);
      if (invoiceResult.error) throw invoiceResult.error;
    }
  } catch (error) {
    await client.from("documents").update({ deleted_at: new Date().toISOString() }).eq("id", documentId);
    await client.storage.from("documents").remove([storagePath]);
    throw error;
  }

  const signed = await client.storage.from("documents").createSignedUrl(storagePath, 3600);
  return { id: documentId, storagePath, previewUrl: signed.data?.signedUrl };
}

export async function deleteWorkspaceDocument(id: string, storagePath?: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is niet geconfigureerd.");
  const deletedAt = new Date().toISOString();
  const [documentResult, invoiceResult, payrollResult] = await Promise.all([
    client.from("documents").update({ deleted_at: deletedAt }).eq("id", id),
    client.from("invoices").update({ deleted_at: deletedAt }).eq("document_id", id),
    client.from("payroll_documents").update({ deleted_at: deletedAt }).eq("document_id", id),
  ]);
  const error = documentResult.error ?? invoiceResult.error ?? payrollResult.error;
  if (error) throw error;
  void storagePath;
}

function databasePaid(value: string) {
  if (value.toUpperCase().includes("TERMIJN")) return "installment";
  return value.toUpperCase().startsWith("JA") ? "yes" : "no";
}

function invoiceKey(direction: string, relation: string, invoice: string, amount: number) {
  return `${direction}|${relation.trim().toLowerCase()}|${invoice.trim().toLowerCase()}|${Number(amount).toFixed(2)}`;
}

export async function syncWorkspaceInvoices(workspace: Workspace, payables: Payable[], receivables: Receivable[]) {
  const client = getSupabaseClient();
  if (!client) return;
  const query = client.from("invoices")
    .select("id, direction, relation_name, invoice_number, amount")
    .eq("organization_id", workspace.organizationId)
    .is("deleted_at", null);
  if (workspace.locationId) query.eq("location_id", workspace.locationId);
  else query.is("location_id", null);
  const existingResult = await query;
  if (existingResult.error) throw existingResult.error;
  const existing = new Map((existingResult.data ?? []).map((row) => [
    invoiceKey(row.direction, row.relation_name, row.invoice_number, Number(row.amount)),
    row.id,
  ]));
  const rows = [
    ...payables.map((item) => ({
      key: invoiceKey("payable", item.company, item.invoice, item.amount),
      values: {
        organization_id: workspace.organizationId,
        location_id: workspace.locationId,
        direction: "payable",
        relation_name: item.company,
        invoice_number: item.invoice,
        amount: item.amount,
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(item.deadline) ? item.deadline : null,
        paid: databasePaid(item.paid),
        source_paid_field: `ui/H:${item.paid}`,
        status: item.paid === "JA" ? "paid" : item.status.toLowerCase().includes("afgekeurd") ? "rejected" : item.status.toLowerCase().includes("goedgekeurd") ? "approved" : "review_required",
        priority: item.priority || "normal",
        notes: item.note,
      },
    })),
    ...receivables.map((item) => ({
      key: invoiceKey("receivable", item.client, item.invoice, item.amount),
      values: {
        organization_id: workspace.organizationId,
        location_id: workspace.locationId,
        direction: "receivable",
        relation_name: item.client,
        invoice_number: item.invoice,
        amount: item.amount,
        invoice_date: /^\d{4}-\d{2}-\d{2}$/.test(item.invoiceDate) ? item.invoiceDate : null,
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : null,
        paid: databasePaid(item.paid),
        source_paid_field: `ui/J:${item.paid}`,
        status: item.paid === "JA" ? "paid" : item.status.toLowerCase().includes("afgekeurd") ? "rejected" : item.status.toLowerCase().includes("goedgekeurd") ? "approved" : "review_required",
        priority: "normal",
        notes: item.action,
        extraction: { customer_email: item.customerEmail ?? "" },
      },
    })),
  ];
  const updates = rows.filter((row) => existing.has(row.key));
  const inserts = rows.filter((row) => !existing.has(row.key));
  const results = await Promise.all([
    ...updates.map((row) => client.from("invoices").update(row.values).eq("id", existing.get(row.key))),
    ...(inserts.length ? [client.from("invoices").insert(inserts.map((row) => row.values))] : []),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}
