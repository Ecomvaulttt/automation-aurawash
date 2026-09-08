import { describe, expect, it } from "vitest";
import { extractInvoiceFields, extractPayrollFields } from "./document-extraction.mjs";

describe("document extraction", () => {
  it("extracts Dutch invoice dates and VAT totals", () => {
    expect(extractInvoiceFields(`
      Factuurnummer INV-2026-088
      Factuurdatum 02-08-2026
      Vervaldatum 16-08-2026
      Totaal excl. btw € 1.000,00
      Btw 21% € 210,00
      Totaal te betalen € 1.210,00
    `)).toMatchObject({
      invoiceNumber: "INV-2026-088",
      invoiceDate: "2026-08-02",
      dueDate: "2026-08-16",
      amountExVat: 1000,
      vatAmount: 210,
      amountIncVat: 1210,
      confidence: 100,
    });
  });

  it("keeps incomplete extraction in review with a lower confidence", () => {
    const result = extractInvoiceFields("Factuurnummer 70954", { amount: 121 });
    expect(result.invoiceNumber).toBe("70954");
    expect(result.amountIncVat).toBe(121);
    expect(result.confidence).toBeLessThan(60);
  });

  it("extracts payroll fields for the review inbox", () => {
    expect(extractPayrollFields(`
      Werknemer Anas Murabe
      Periode 07-2026
      Personeelsnummer 115wn0005
      Bruto loon 2.598,27
      Netto loon 2.296,45
    `)).toMatchObject({ employee: "Anas Murabe", period: "07-2026", payrollNumber: "115wn0005", gross: 2598.27, net: 2296.45 });
  });
});
