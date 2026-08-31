import JSZip from "jszip";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceDocument, Payable, PayrollDoc, Receivable, Salary, TaxItem } from "../data";
import { downloadBlob, toCsv } from "./export";

type InvoiceProfile = { companyName: string; sector: string; brandColor: string };
type InvoiceDraft = { client: string; email: string; invoiceNumber: string; description: string; amount: string; dueDate: string };

function hexColor(value: string) {
  const match = value.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!match) return rgb(45 / 255, 91 / 255, 1);
  return rgb(parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255);
}

function money(value: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function safeName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._ -]/g, "").replace(/\s+/g, "-").slice(0, 120);
}

function fitPdfText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const safe = String(value || "").normalize("NFKD").replace(/[^\x20-\x7e\u00a0-\u00ff\u20ac]/gi, "");
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
  let output = safe;
  while (output && font.widthOfTextAtSize(`${output}...`, size) > maxWidth) output = output.slice(0, -1);
  return `${output}...`;
}

export async function createInvoicePdf(profile: InvoiceProfile, draft: InvoiceDraft, date: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = hexColor(profile.brandColor);
  const amount = Number(draft.amount) || 0;
  page.drawRectangle({ x: 0, y: 790, width: 595.28, height: 52, color: rgb(11 / 255, 11 / 255, 12 / 255) });
  page.drawText(fitPdfText(profile.companyName, bold, 18, 500), { x: 42, y: 810, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("FACTUUR", { x: 42, y: 724, size: 34, font: bold, color: rgb(11 / 255, 11 / 255, 12 / 255) });
  page.drawRectangle({ x: 42, y: 705, width: 72, height: 4, color: accent });
  page.drawText(fitPdfText(`Factuurnummer: ${draft.invoiceNumber || "Concept"}`, regular, 10, 200), { x: 350, y: 730, size: 10, font: regular });
  page.drawText(`Factuurdatum: ${date}`, { x: 350, y: 714, size: 10, font: regular });
  page.drawText(`Vervaldatum: ${draft.dueDate || "-"}`, { x: 350, y: 698, size: 10, font: regular });
  page.drawText("Factureren aan", { x: 42, y: 642, size: 10, font: bold, color: rgb(0.35, 0.35, 0.35) });
  page.drawText(fitPdfText(draft.client || "Klant", bold, 16, 510), { x: 42, y: 620, size: 16, font: bold });
  if (draft.email) page.drawText(fitPdfText(draft.email, regular, 10, 510), { x: 42, y: 603, size: 10, font: regular });
  page.drawRectangle({ x: 42, y: 505, width: 511, height: 42, color: rgb(245 / 255, 242 / 255, 237 / 255) });
  page.drawText("Omschrijving", { x: 54, y: 522, size: 10, font: bold });
  page.drawText("Bedrag", { x: 462, y: 522, size: 10, font: bold });
  page.drawText(fitPdfText(draft.description || "Dienstverlening", regular, 11, 375), { x: 54, y: 477, size: 11, font: regular });
  page.drawText(money(amount), { x: 455, y: 477, size: 11, font: bold });
  page.drawLine({ start: { x: 42, y: 456 }, end: { x: 553, y: 456 }, thickness: 1, color: rgb(0.87, 0.85, 0.8) });
  page.drawText("Totaal", { x: 390, y: 417, size: 13, font: bold });
  page.drawText(money(amount), { x: 455, y: 417, size: 13, font: bold, color: accent });
  page.drawText(fitPdfText(`${profile.companyName} | ${profile.sector}`, regular, 9, 275), { x: 42, y: 56, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });
  page.drawText("Gegenereerd vanuit EcomVault Ops Cockpit", { x: 350, y: 56, size: 8, font: regular, color: rgb(0.4, 0.4, 0.4) });
  const bytes = await pdf.save();
  const buffer = new Uint8Array(bytes).buffer;
  return {
    filename: `factuur-${safeName(draft.invoiceNumber || date)}.pdf`,
    blob: new Blob([buffer], { type: "application/pdf" }),
  };
}

export async function downloadInvoicePdf(profile: InvoiceProfile, draft: InvoiceDraft, date: string) {
  const invoice = await createInvoicePdf(profile, draft, date);
  downloadBlob(invoice.filename, invoice.blob);
}

export type AccountantExportInput = {
  companyName: string;
  generatedAt: string;
  period: string;
  totals: Record<string, number>;
  salaries: Salary[];
  taxes: TaxItem[];
  payables: Payable[];
  receivables: Receivable[];
  payrollDocs: PayrollDoc[];
  invoiceDocs: InvoiceDocument[];
  json: Record<string, unknown>;
  summaryHtml: string;
};

export async function createAccountantPackage(input: AccountantExportInput) {
  const zip = new JSZip();
  zip.file("README.txt", [
    `${input.companyName} - boekhouderpakket`,
    `Gegenereerd: ${input.generatedAt}`,
    `Periode: ${input.period}`,
    "",
    "De map data bevat machineleesbare CSV/JSON-bestanden. De map bewijsstukken bevat beschikbare PDF's en afbeeldingen.",
  ].join("\n"));
  zip.file("overzicht.html", input.summaryHtml);
  zip.file("data/volledig-pakket.json", JSON.stringify(input.json, null, 2));
  zip.file("data/kerncijfers.csv", toCsv(Object.entries(input.totals).map(([post, bedrag]) => ({ post, bedrag }))));
  zip.file("data/salarissen.csv", toCsv(input.salaries));
  zip.file("data/belastingen.csv", toCsv(input.taxes));
  zip.file("data/te-betalen.csv", toCsv(input.payables.map(({ documentIds, ...row }) => ({ ...row, documenten: documentIds?.join(", ") ?? "" }))));
  zip.file("data/te-ontvangen.csv", toCsv(input.receivables.map(({ documentIds, ...row }) => ({ ...row, documenten: documentIds?.join(", ") ?? "" }))));
  zip.file("data/loonstroken.csv", toCsv(input.payrollDocs));

  const missingEvidence: string[] = [];
  const addEvidence = async (folder: string, id: string, fileName: string, previewUrl?: string) => {
    if (!previewUrl) {
      missingEvidence.push(`${id}: ${fileName}`);
      return;
    }
    try {
      const response = await fetch(previewUrl);
      if (!response.ok) throw new Error(String(response.status));
      zip.file(`bewijsstukken/${folder}/${safeName(id)}-${safeName(fileName)}`, new Uint8Array(await response.arrayBuffer()));
    } catch {
      missingEvidence.push(`${id}: ${fileName}`);
    }
  };
  await Promise.all([
    ...input.invoiceDocs.map((document) => addEvidence("facturen", document.invoiceNumber || document.id, document.fileName, document.previewUrl)),
    ...input.payrollDocs.map((document) => addEvidence("loonstroken", `${document.employee}-${document.period}`, document.fileName, document.previewUrl)),
  ]);
  if (missingEvidence.length) zip.file("bewijsstukken/ONTBREKEND.txt", missingEvidence.join("\n"));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return {
    filename: `boekhouderpakket-${safeName(input.companyName)}-${input.generatedAt}.zip`,
    blob,
    missingEvidence,
  };
}

export async function downloadAccountantPackage(input: AccountantExportInput) {
  const result = await createAccountantPackage(input);
  downloadBlob(result.filename, result.blob);
}
