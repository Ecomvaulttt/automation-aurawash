import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAccountantPackage, createInvoicePdf, type AccountantExportInput } from "./accounting-export";

afterEach(() => vi.unstubAllGlobals());

describe("branded accounting exports", () => {
  it("creates a valid single-page PDF and safely fits long customer text", async () => {
    const result = await createInvoicePdf(
      { companyName: "AuraWash 🚗".repeat(20), sector: "Automotive", brandColor: "#2D5BFF" },
      {
        client: "Zeer lange klantnaam ".repeat(30),
        email: "finance@example.com",
        invoiceNumber: "VF260099",
        description: "Complete poetsbehandeling ".repeat(30),
        amount: "1250.50",
        dueDate: "2026-09-30",
      },
      "2026-08-31",
    );
    expect(result.filename).toBe("factuur-VF260099.pdf");
    expect(result.blob.type).toBe("application/pdf");
    const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(pdf.getPageCount()).toBe(1);
  });

  it("builds a complete ZIP with invoice and payroll evidence plus a missing-evidence report", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("invoice.pdf")) return new Response(new Blob(["invoice"]), { status: 200 });
      return new Response("not found", { status: 404 });
    }));
    const input: AccountantExportInput = {
      companyName: "AuraWash",
      generatedAt: "2026-08-31",
      period: "Augustus 2026",
      totals: { beschikbaar: 5000, open: 1200 },
      salaries: [{ name: "Medewerker", salary: 2000, holidayPay: 160, total: 2160, status: "Actief" }],
      taxes: [{ type: "BTW", amount: 500, deadline: "2026-09-30", arrangement: "NEE", priority: "Hoog", status: "open", paid: "NEE" }],
      payables: [{ company: "Leverancier", invoice: "INV-1", amount: 100, deadline: "2026-09-05", priority: "Hoog", status: "Open", note: "", paid: "NEE" }],
      receivables: [{ client: "Klant", invoice: "VF-1", amount: 250, invoiceDate: "2026-08-01", dueDate: "2026-09-03", status: "Open", action: "", paid: "NEE" }],
      payrollDocs: [{ id: "payroll-1", employee: "Medewerker", period: "2026-08", fileName: "loonstrook.pdf", uploadedAt: "2026-08-31", status: "Goedgekeurd", gross: 2500, net: 2000 }],
      invoiceDocs: [{
        id: "document-1", type: "te-betalen", source: "email", direction: "inkomend", relation: "Leverancier",
        invoiceNumber: "INV-1", subject: "Factuur", sender: "Leverancier", fileName: "invoice.pdf", mimeType: "application/pdf",
        receivedAt: "2026-08-31", dueDate: "2026-09-05", amount: 100, paid: "NEE", status: "Goedgekeurd", category: "Inkoop",
        previewUrl: "https://files.test/invoice.pdf",
      }],
      json: { ok: true },
      summaryHtml: "<!doctype html><title>AuraWash</title>",
    };
    const result = await createAccountantPackage(input);
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    const files = Object.keys(zip.files);
    expect(files).toContain("data/te-betalen.csv");
    expect(files).toContain("data/loonstroken.csv");
    expect(files).toContain("bewijsstukken/facturen/INV-1-invoice.pdf");
    expect(files).toContain("bewijsstukken/ONTBREKEND.txt");
    expect(result.missingEvidence).toContain("Medewerker-2026-08: loonstrook.pdf");
  });
});
