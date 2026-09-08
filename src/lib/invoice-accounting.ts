import type { Payable, Receivable } from "../data";

export const DEFAULT_VAT_RATE = 0.21;

type InvoiceAmounts = {
  amount: number;
  amountExVat?: number;
  vatAmount?: number;
  amountIncVat?: number;
};

export type MonthlyInvoiceSummary = {
  month: string;
  revenueExVat: number;
  revenueVat: number;
  revenueIncVat: number;
  costsExVat: number;
  reclaimableVat: number;
  costsIncVat: number;
  resultExVat: number;
  breakEvenRemaining: number;
  vatBalance: number;
  approvedCount: number;
  reviewCount: number;
  rejectedCount: number;
  missingInvoiceDateCount: number;
};

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function invoiceAmounts(item: InvoiceAmounts, vatRate = DEFAULT_VAT_RATE) {
  const explicitInc = Number(item.amountIncVat);
  const explicitEx = Number(item.amountExVat);
  const explicitVat = Number(item.vatAmount);
  const legacyAmount = Number(item.amount || 0);

  if (Number.isFinite(explicitInc) && explicitInc > 0) {
    const exVat = Number.isFinite(explicitEx) && explicitEx > 0
      ? explicitEx
      : explicitInc / (1 + vatRate);
    const vat = Number.isFinite(explicitVat) && explicitVat >= 0
      ? explicitVat
      : explicitInc - exVat;
    return { exVat: roundMoney(exVat), vat: roundMoney(vat), incVat: roundMoney(explicitInc) };
  }

  if (Number.isFinite(explicitEx) && explicitEx > 0) {
    const vat = Number.isFinite(explicitVat) && explicitVat >= 0
      ? explicitVat
      : explicitEx * vatRate;
    return { exVat: roundMoney(explicitEx), vat: roundMoney(vat), incVat: roundMoney(explicitEx + vat) };
  }

  const incVat = Number.isFinite(legacyAmount) ? legacyAmount : 0;
  const exVat = incVat / (1 + vatRate);
  return { exVat: roundMoney(exVat), vat: roundMoney(incVat - exVat), incVat: roundMoney(incVat) };
}

export function invoiceReviewStatus(item: { reviewStatus?: string; status?: string }): "Controle" | "Goedgekeurd" | "Afgekeurd" {
  if (item.reviewStatus === "Controle" || item.reviewStatus === "Goedgekeurd" || item.reviewStatus === "Afgekeurd") return item.reviewStatus;
  const status = String(item.status || "").toLowerCase();
  if (status.includes("afgekeurd")) return "Afgekeurd" as const;
  if (status.includes("controle") || status.includes("nieuw")) return "Controle" as const;
  return "Goedgekeurd" as const;
}

export function invoiceMonth(value?: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value).slice(0, 7) : "";
}

export function availableInvoiceMonths(payables: Payable[], receivables: Receivable[]) {
  return Array.from(new Set([
    ...payables.map((item) => invoiceMonth(item.invoiceDate)),
    ...receivables.map((item) => invoiceMonth(item.invoiceDate)),
  ].filter(Boolean))).sort((a, b) => b.localeCompare(a));
}

export function monthlyInvoiceSummary(payables: Payable[], receivables: Receivable[], month: string): MonthlyInvoiceSummary {
  const relevantPayables = payables.filter((item) => invoiceMonth(item.invoiceDate) === month);
  const relevantReceivables = receivables.filter((item) => invoiceMonth(item.invoiceDate) === month);
  const allInvoices = [...relevantPayables, ...relevantReceivables];
  const approvedPayables = relevantPayables.filter((item) => invoiceReviewStatus(item) === "Goedgekeurd");
  const approvedReceivables = relevantReceivables.filter((item) => invoiceReviewStatus(item) === "Goedgekeurd");

  const payableAmounts = approvedPayables.map((item) => invoiceAmounts(item));
  const receivableAmounts = approvedReceivables.map((item) => invoiceAmounts(item));
  const revenueExVat = roundMoney(receivableAmounts.reduce((total, item) => total + item.exVat, 0));
  const revenueVat = roundMoney(receivableAmounts.reduce((total, item) => total + item.vat, 0));
  const revenueIncVat = roundMoney(receivableAmounts.reduce((total, item) => total + item.incVat, 0));
  const costsExVat = roundMoney(payableAmounts.reduce((total, item) => total + item.exVat, 0));
  const reclaimableVat = roundMoney(approvedPayables.reduce((total, item) => {
    if (item.vatReclaimable === false) return total;
    return total + invoiceAmounts(item).vat;
  }, 0));
  const costsIncVat = roundMoney(payableAmounts.reduce((total, item) => total + item.incVat, 0));
  const resultExVat = roundMoney(revenueExVat - costsExVat);

  return {
    month,
    revenueExVat,
    revenueVat,
    revenueIncVat,
    costsExVat,
    reclaimableVat,
    costsIncVat,
    resultExVat,
    breakEvenRemaining: roundMoney(Math.max(0, costsExVat - revenueExVat)),
    vatBalance: roundMoney(revenueVat - reclaimableVat),
    approvedCount: allInvoices.filter((item) => invoiceReviewStatus(item) === "Goedgekeurd").length,
    reviewCount: allInvoices.filter((item) => invoiceReviewStatus(item) === "Controle").length,
    rejectedCount: allInvoices.filter((item) => invoiceReviewStatus(item) === "Afgekeurd").length,
    missingInvoiceDateCount: [
      ...payables.filter((item) => !invoiceMonth(item.invoiceDate)),
      ...receivables.filter((item) => !invoiceMonth(item.invoiceDate)),
    ].length,
  };
}

export function monthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return "Geen maand geselecteerd";
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" })
    .format(new Date(`${month}-01T12:00:00`));
}
