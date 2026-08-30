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

  it("treats blank paid cells conservatively and normalizes Dutch values", () => {
    const result = parseAuraSheets([
      { sheet: "Beschikbaar geld", data: [["Naam", "Bedrag"], ["Bank", "EUR 1.234,56"]] },
      { sheet: "Salarissen + (vakantiegeld)", data: [["Naam", "Salaris", "Vakantiegeld", "Totaal"], ["Medewerker", "2.000,00", "160,00", "2.160,00"]] },
      { sheet: "Belastingen", data: [["Soort", "Bedrag", "Deadline", "Regeling", "Prioriteit", "Status", "Betaald"], ["BTW", "500,00", "31-08-2026", "NEE", "Hoog", "open", "JA (termijn)"]] },
      { sheet: "Vaste Lasten (bedrijven)", data: [["Bedrijf", "Per maand", "Auto", "Belang", "Status", "Open", "Notitie"]] },
      { sheet: "Openstaande facturen", data: [["Bedrijf", "Nummer", "Bedrag", "Deadline", "Prioriteit", "Status", "Notitie", "Betaald"], ["Leverancier", "INV-2", "1.234,56", "31/08/2026", "Hoog", "Betaald", "", ""]] },
      { sheet: "Te ontvangen facturen", data: [["Klant", "Nummer", "Bedrag", "Datum", "Vervaldatum", "Status", "Actie", "", "", "Betaald"], ["Klant", "VF-2", "99,95", "01-08-2026", "31-08-2026", "Betaald", "", "", "", null]] },
    ]);
    expect(result.balances[0].amount).toBe(1234.56);
    expect(result.salaries[0].total).toBe(2160);
    expect(result.taxes[0]).toMatchObject({ deadline: "2026-08-31", paid: "JA (termijn)" });
    expect(result.payables[0]).toMatchObject({ amount: 1234.56, deadline: "2026-08-31", paid: "NEE" });
    expect(result.receivables[0].paid).toBe("NEE");
  });

  it("reports every missing required worksheet", () => {
    const result = parseAuraSheets([]);
    expect(result.warnings).toHaveLength(6);
    expect(result.payables).toEqual([]);
    expect(result.receivables).toEqual([]);
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

  it("parses quoted descriptions and separate debit/credit columns", async () => {
    const file = new File([
      "Datum;Omschrijving;Afschrijving;Bijschrijving\n30-08-2026;\"Wasstraat; onderhoud\";25,50;\n31-08-2026;Klantbetaling;;100,00",
    ], "bank.csv", { type: "text/csv" });
    const result = await parseBankFile(file);
    expect(result.transactions.map((row) => row.amount)).toEqual([-25.5, 100]);
    expect(result.transactions[0].description).toBe("Wasstraat; onderhoud");
    expect(result.latestBalance).toBeNull();
    expect(result.warnings).toContain("Geen saldokolom gevonden; alleen netto mutatie is berekend.");
  });

  it("rejects an unrecognized bank export instead of guessing", async () => {
    const file = new File(["Kolom A;Kolom B\nfoo;bar"], "bank.csv", { type: "text/csv" });
    await expect(parseBankFile(file)).rejects.toThrow("Kolommen voor datum en bedrag");
  });
});
