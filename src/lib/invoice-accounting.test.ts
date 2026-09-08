import { describe, expect, it } from "vitest";
import type { Payable, Receivable } from "../data";
import { availableInvoiceMonths, invoiceAmounts, invoiceReviewStatus, monthlyInvoiceSummary } from "./invoice-accounting";

const payable = (patch: Partial<Payable> = {}): Payable => ({
  company: "Leverancier",
  invoice: "INK-1",
  invoiceDate: "2026-08-02",
  amount: 121,
  deadline: "2026-08-16",
  priority: "Normaal",
  status: "Open",
  reviewStatus: "Goedgekeurd",
  vatReclaimable: true,
  note: "",
  paid: "NEE",
  ...patch,
});

const receivable = (patch: Partial<Receivable> = {}): Receivable => ({
  client: "Klant",
  invoice: "VER-1",
  amount: 242,
  invoiceDate: "2026-08-08",
  dueDate: "2026-08-22",
  status: "Open",
  reviewStatus: "Goedgekeurd",
  action: "",
  paid: "NEE",
  ...patch,
});

describe("invoice accounting", () => {
  it("derives ex VAT and VAT from legacy inclusive amounts", () => {
    expect(invoiceAmounts({ amount: 121 })).toEqual({ exVat: 100, vat: 21, incVat: 121 });
  });

  it("uses invoice date and ignores payment status for monthly profit", () => {
    const summary = monthlyInvoiceSummary([payable({ paid: "JA" })], [receivable({ paid: "NEE" })], "2026-08");
    expect(summary).toMatchObject({
      revenueExVat: 200,
      costsExVat: 100,
      resultExVat: 100,
      breakEvenRemaining: 0,
      revenueVat: 42,
      reclaimableVat: 21,
      vatBalance: 21,
    });
  });

  it("keeps review and rejected invoices outside the figures", () => {
    const summary = monthlyInvoiceSummary(
      [payable({ reviewStatus: "Controle" })],
      [receivable({ reviewStatus: "Afgekeurd" })],
      "2026-08",
    );
    expect(summary.resultExVat).toBe(0);
    expect(summary.reviewCount).toBe(1);
    expect(summary.rejectedCount).toBe(1);
  });

  it("reports a VAT refund as a negative VAT balance", () => {
    const summary = monthlyInvoiceSummary([payable({ amount: 242 })], [receivable({ amount: 121 })], "2026-08");
    expect(summary.vatBalance).toBe(-21);
  });

  it("sorts only months backed by real invoice dates", () => {
    expect(availableInvoiceMonths(
      [payable({ invoiceDate: "" }), payable({ invoiceDate: "2026-07-01" })],
      [receivable()],
    )).toEqual(["2026-08", "2026-07"]);
  });

  it("treats legacy open rows as approved but control rows as pending", () => {
    expect(invoiceReviewStatus({ status: "OPEN" })).toBe("Goedgekeurd");
    expect(invoiceReviewStatus({ status: "Controle" })).toBe("Controle");
  });
});
