import readXlsxFile, { CellValue, Sheet } from "read-excel-file/browser";
import type { Balance, FixedCost, Payable, Receivable, Salary, TaxItem } from "../data";

type NullableCellValue = CellValue | null | undefined;

export type AuraWorkbookImport = {
  balances: Balance[];
  salaries: Salary[];
  taxes: TaxItem[];
  fixedCosts: FixedCost[];
  payables: Payable[];
  receivables: Receivable[];
  warnings: string[];
};

export type BankTransaction = {
  date: string;
  description: string;
  amount: number;
  balance: number | null;
};

export type BankImport = {
  transactions: BankTransaction[];
  latestBalance: number | null;
  netMovement: number;
  firstDate: string;
  lastDate: string;
  warnings: string[];
};

function text(value: NullableCellValue) {
  return String(value ?? "").trim();
}

function numeric(value: NullableCellValue) {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: NullableCellValue) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const input = String(value ?? "").trim();
  if (!input) return "";
  const iso = input.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dutch = input.match(/^(\d{1,2})[-/](\d{1,2})[-/](20\d{2})$/);
  if (dutch) return `${dutch[3]}-${dutch[2].padStart(2, "0")}-${dutch[1].padStart(2, "0")}`;
  return input;
}

function paidValue(value: NullableCellValue): "JA" | "NEE" | "JA (termijn)" {
  const normalized = text(value).toUpperCase();
  if (normalized.includes("TERMIJN")) return "JA (termijn)";
  return normalized.startsWith("JA") ? "JA" : "NEE";
}

function worksheetByName(workbook: Sheet[], expected: string) {
  const normalized = expected.trim().toLowerCase();
  return workbook.find((sheet) => sheet.sheet.trim().toLowerCase() === normalized);
}

function dataRows(sheet: Sheet | undefined, minimumColumns: number) {
  if (!sheet) return [];
  return sheet.data.slice(1).filter((row) => row.slice(0, minimumColumns).some((value) => text(value)));
}

export async function parseAuraWorkbook(input: ArrayBuffer): Promise<AuraWorkbookImport> {
  return parseAuraSheets(await readXlsxFile(input));
}

export function parseAuraSheets(workbook: Sheet[]): AuraWorkbookImport {
  const warnings: string[] = [];
  const requiredSheets = [
    "Beschikbaar geld",
    "Salarissen + (vakantiegeld)",
    "Belastingen",
    "Vaste Lasten (bedrijven)",
    "Openstaande facturen",
    "Te ontvangen facturen",
  ];
  requiredSheets.forEach((name) => {
    if (!worksheetByName(workbook, name)) warnings.push(`Werkblad ontbreekt: ${name}`);
  });

  const balances = dataRows(worksheetByName(workbook, "Beschikbaar geld"), 2)
    .filter((row) => text(row[0]) && !text(row[0]).toLowerCase().includes("totaal"))
    .map((row) => ({ label: text(row[0]), amount: numeric(row[1]) }));

  const salaries = dataRows(worksheetByName(workbook, "Salarissen + (vakantiegeld)"), 4)
    .filter((row) => text(row[0]))
    .map((row) => {
      const salary = numeric(row[1]);
      const holidayPay = text(row[2]) ? numeric(row[2]) : null;
      return {
        name: text(row[0]),
        salary,
        holidayPay,
        total: numeric(row[3]) || salary + (holidayPay ?? 0),
        status: "Actief" as const,
      };
    });

  const taxes = dataRows(worksheetByName(workbook, "Belastingen"), 7)
    .filter((row) => text(row[0]))
    .map((row) => ({
      type: text(row[0]), amount: numeric(row[1]), deadline: isoDate(row[2]), arrangement: text(row[3]),
      priority: text(row[4]), status: text(row[5]), paid: paidValue(row[6]),
    }));

  const fixedCosts = dataRows(worksheetByName(workbook, "Vaste Lasten (bedrijven)"), 7)
    .filter((row) => text(row[0]))
    .map((row) => ({
      company: text(row[0]), monthly: numeric(row[1]), automatic: text(row[2]), importance: text(row[3]),
      status: text(row[4]), open: numeric(row[5]), note: text(row[6]),
    }));

  const payables = dataRows(worksheetByName(workbook, "Openstaande facturen"), 8)
    .filter((row) => text(row[0]))
    .map((row) => ({
      company: text(row[0]), invoice: text(row[1]), amount: numeric(row[2]), deadline: isoDate(row[3]),
      priority: text(row[4]), status: text(row[5]), note: text(row[6]),
      // Source of truth: workbook column H `Betaald?`.
      paid: paidValue(row[7]),
    }));

  const receivables = dataRows(worksheetByName(workbook, "Te ontvangen facturen"), 10)
    .filter((row) => text(row[0]))
    .map((row) => ({
      client: text(row[0]), invoice: text(row[1]), amount: numeric(row[2]), invoiceDate: isoDate(row[3]),
      dueDate: isoDate(row[4]), status: text(row[5]), action: text(row[6]),
      // Source of truth: workbook column J `Beataald`.
      paid: paidValue(row[9]),
    }));

  return { balances, salaries, taxes, fixedCosts, payables, receivables, warnings };
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findColumn(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
}

function parseDelimited(content: string) {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const delimiters = [";", ",", "\t"];
  const delimiter = delimiters.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  return content.split(/\r?\n/).filter(Boolean).map((line) => {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
        else quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        values.push(current.trim());
        current = "";
      } else current += character;
    }
    values.push(current.trim());
    return values;
  });
}

export async function parseBankFile(file: File): Promise<BankImport> {
  let rows: unknown[][] = [];
  if (/\.csv$/i.test(file.name) || file.type.includes("csv")) {
    rows = parseDelimited(await file.text());
  } else {
    const workbook = await readXlsxFile(await file.arrayBuffer());
    rows = workbook[0]?.data ?? [];
  }
  if (rows.length < 2) throw new Error("Geen banktransacties gevonden.");

  const headers = rows[0].map(normalizeHeader);
  const dateIndex = findColumn(headers, ["boekdatum", "transactiedatum", "datum", "date"]);
  const descriptionIndex = findColumn(headers, ["omschrijving", "mededeling", "description", "naamomschrijving", "tegenpartij"]);
  const amountIndex = findColumn(headers, ["bedrageur", "bedrag", "amount", "mutatie"]);
  const debitIndex = findColumn(headers, ["afschrijving", "debit"]);
  const creditIndex = findColumn(headers, ["bijschrijving", "credit"]);
  const balanceIndex = findColumn(headers, ["saldo", "balance"]);
  if (dateIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    throw new Error("Kolommen voor datum en bedrag konden niet automatisch worden herkend.");
  }

  const transactions = rows.slice(1).map((row) => {
    const amount = amountIndex >= 0
      ? numeric(row[amountIndex] as CellValue)
      : numeric(row[creditIndex] as CellValue) - Math.abs(numeric(row[debitIndex] as CellValue));
    return {
      date: isoDate(row[dateIndex] as CellValue),
      description: descriptionIndex >= 0 ? String(row[descriptionIndex] ?? "").trim() : "Bankmutatie",
      amount,
      balance: balanceIndex >= 0 && String(row[balanceIndex] ?? "").trim() ? numeric(row[balanceIndex] as CellValue) : null,
    };
  }).filter((row) => row.date && Number.isFinite(row.amount));
  transactions.sort((a, b) => a.date.localeCompare(b.date));
  const balances = transactions.filter((row) => row.balance !== null);
  const latestBalance = balances.at(-1)?.balance ?? null;
  const warnings: string[] = [];
  if (latestBalance === null) warnings.push("Geen saldokolom gevonden; alleen netto mutatie is berekend.");
  if (!transactions.length) warnings.push("Geen geldige transactieregels gevonden.");
  return {
    transactions,
    latestBalance,
    netMovement: transactions.reduce((total, row) => total + row.amount, 0),
    firstDate: transactions[0]?.date ?? "",
    lastDate: transactions.at(-1)?.date ?? "",
    warnings,
  };
}
