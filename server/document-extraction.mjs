const moneyPattern = "(?:\\d{1,3}(?:[.\\s]\\d{3})*|\\d+)[,.]\\d{2}";
const datePattern = "(?:\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|20\\d{2}[-/.]\\d{1,2}[-/.]\\d{1,2})";

function money(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function isoDate(value) {
  const input = String(value || "").trim();
  const iso = input.match(/^(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!local) return "";
  const year = local[3].length === 2 ? `20${local[3]}` : local[3];
  return `${year}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

function labelled(text, labels, pattern) {
  const expression = new RegExp(`(?:^|\\n)\\s*(?:${labels.join("|")})\\s*(?:[:#-]\\s*)?(?:€|EUR)?\\s*(${pattern})`, "im");
  return text.match(expression)?.[1] || "";
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function extractInvoiceFields(rawText, fallback = {}) {
  const text = String(rawText || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  let amountIncVat = money(labelled(text, ["totaal te betalen", "te betalen", "totaal incl(?:usief)? btw", "invoice total", "amount due", "grand total"], moneyPattern));
  let amountExVat = money(labelled(text, ["totaal excl(?:usief)? btw", "subtotaal", "subtotal", "net amount"], moneyPattern));
  let vatAmount = money(labelled(text, ["btw(?: 21%)?", "vat", "vat amount", "tax"], moneyPattern));

  if (!amountIncVat && amountExVat && vatAmount) amountIncVat = round(amountExVat + vatAmount);
  if (!amountExVat && amountIncVat && vatAmount) amountExVat = round(amountIncVat - vatAmount);
  if (!vatAmount && amountIncVat && amountExVat) vatAmount = round(amountIncVat - amountExVat);
  if (!amountIncVat && fallback.amount) amountIncVat = money(fallback.amount);

  const invoiceDate = isoDate(labelled(text, ["factuurdatum", "invoice date", "datum"], datePattern));
  const dueDate = isoDate(labelled(text, ["vervaldatum", "uiterste betaaldatum", "due date", "payment due"], datePattern));
  const invoiceNumber = labelled(text, ["factuurnummer", "factuur nr\\.?", "invoice number", "invoice no\\.?"], "[A-Z0-9][A-Z0-9/._-]{3,}")
    || String(fallback.invoiceNumber || "");
  const found = [invoiceNumber, invoiceDate, dueDate, amountIncVat, amountExVat, vatAmount].filter(Boolean).length;

  return {
    invoiceNumber,
    invoiceDate,
    dueDate,
    amountExVat,
    vatAmount,
    amountIncVat,
    confidence: Math.round((found / 6) * 100),
    extractedText: text.slice(0, 8_000),
  };
}

export function extractPayrollFields(rawText, fallback = {}) {
  const text = String(rawText || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  const employee = labelled(text, ["werknemer", "medewerker", "employee", "naam"], "[A-ZÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]{2,80}")
    || String(fallback.employee || "");
  const period = labelled(text, ["periode", "loontijdvak", "period"], "(?:0?[1-9]|1[0-2])(?:\\s*[-=/]\\s*20\\d{2})?|20\\d{2}[-/]\\d{1,2}")
    || String(fallback.period || "");
  const gross = money(labelled(text, ["bruto loon", "brutoloon", "gross pay", "totaal bruto"], moneyPattern));
  const net = money(labelled(text, ["netto loon", "nettoloon", "net pay", "uit te betalen"], moneyPattern));
  const payrollNumber = labelled(text, ["personeelsnummer", "werknemernummer", "payroll number"], "[A-Z0-9][A-Z0-9._-]{2,}");
  const found = [employee, period, gross, net, payrollNumber].filter(Boolean).length;
  return { employee, period, gross, net, payrollNumber, confidence: Math.round((found / 5) * 100), extractedText: text.slice(0, 8_000) };
}

export async function extractDocumentText(content, mimeType, fileName) {
  if (mimeType !== "application/pdf" && !/\.pdf$/i.test(String(fileName || ""))) return "";
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: content });
  try {
    const result = await parser.getText();
    return String(result.text || "");
  } finally {
    await parser.destroy();
  }
}
