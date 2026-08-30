import { describe, expect, it } from "vitest";
import { parseAuraSheets, parseBankFile } from "./imports";

describe("parseAuraSheets", () => {
  it("uses columns H and J as payment truth", () => {
    const result = parseAuraSheets([
      { sheet: "Beschikbaar geld", data: [["Header"]] },
      { sheet: "Salarissen + (vakantiegeld)", data: [["Header"]] },
      { sheet: "Belastingen", data: [["Header"]] },
      { sheet: "Vaste Lasten (bedrijven)", data: [["Header"]] },
      {
        sheet: "Openstaande facturen",
        data: [
          ["Bedrijf", "Factuurnummer", "Bedrag", "Deadline", "Prioriteit", "Status", "Opmerking", "Betaald?"],
          ["Leverancier", "INV-1", 100, "2026-08-30", "hoog", "Betaald", "", "NEE"],
        ],
      },
      {
        sheet: "Te ontvangen facturen",
        data: [
          ["Klant", "Factuurnummer", "Bedrag", "Factuurdatum", "Vervaldatum", "Status", "Actie", "", "", "Beataald"],
          ["Klant", "VF-1", 200, "2026-08-01", "2026-08-31", "Betaald", "", "", "", "NEE"],
        ],
      },
    ]);
    expect(result.payables[0].paid).toBe("NEE");
    expect(result.receivables[0].paid).toBe("NEE");
  });
});

describe("parseBankFile", () => {
  it("calculates movement and latest balance from CSV", async () => {
    const file = new File([
      "Boekdatum;Omschrijving;Bedrag;Saldo\n30-08-2026;Klantbetaling;100,00;1500,00\n31-08-2026;Inkoop;-25,00;1475,00",
    ], "bank.csv", { type: "text/csv" });
    const result = await parseBankFile(file);
    expect(result.transactions).toHaveLength(2);
    expect(result.netMovement).toBe(75);
    expect(result.latestBalance).toBe(1475);
  });
});
