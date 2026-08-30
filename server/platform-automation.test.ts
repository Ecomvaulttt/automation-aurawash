import { describe, expect, it } from "vitest";
import { classifyDocument, extractInvoiceNumber } from "./platform-automation.mjs";

describe("platform automation classification", () => {
  it("recognizes payroll and invoice types", () => {
    expect(classifyDocument("Loonstrook augustus", "murabe.pdf")).toBe("loonstrook");
    expect(classifyDocument("Verkoopfactuur VF260041", "VF260041.pdf")).toBe("te-ontvangen");
    expect(classifyDocument("Factuur", "INV-802.pdf")).toBe("te-betalen");
  });

  it("extracts the invoice number", () => {
    expect(extractInvoiceNumber("Factuur VF260041", "document.pdf")).toBe("VF260041");
  });
});
