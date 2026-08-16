import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileArchive,
  FileCheck2,
  FileJson,
  FileSpreadsheet,
  FolderUp,
  Gauge,
  Plus,
  ReceiptText,
  Search,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import {
  balances as initialBalances,
  fixedCosts as initialFixedCosts,
  payables as initialPayables,
  PayrollDoc,
  receivables as initialReceivables,
  salaries as initialSalaries,
  samplePayrollDocs,
  taxes as initialTaxes,
  Salary,
  TaxItem,
  Payable,
  Receivable,
} from "./data";
import { downloadFile, ExportRow, toCsv } from "./lib/export";
import { cn } from "./lib/utils";

const logoUrl =
  "https://aurawash.nl/cdn/shop/files/logo_top_site.png?v=1770326175&width=360";

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const number = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 0,
});

const today = new Date().toISOString().slice(0, 10);

type Tab = "overzicht" | "loonstroken" | "instanties" | "facturen";
type PaidValue = "JA" | "NEE" | "JA (termijn)";
type Balance = (typeof initialBalances)[number];
type FixedCost = (typeof initialFixedCosts)[number];

function loadStored<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveStored<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in strict browser settings. The app still works for the current session.
  }
}

function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => loadStored(key, fallback));

  function setStored(next: T | ((current: T) => T)) {
    setValue((current) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      saveStored(key, resolved);
      return resolved;
    });
  }

  return [value, setStored] as const;
}

function updateIndex<T>(items: T[], index: number, patch: Partial<T>) {
  return items.map((item, currentIndex) =>
    currentIndex === index ? { ...item, ...patch } : item,
  );
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function isOpen(value: string) {
  return ["open", "niet betaald", "nee", "in behandeling"].some((term) =>
    value.toLowerCase().includes(term),
  );
}

function isPaidNo(value: string) {
  return value.trim().toUpperCase() === "NEE";
}

function normalizePaid(value: string): PaidValue {
  return value.includes("termijn") ? "JA (termijn)" : value.trim().toUpperCase() === "JA" ? "JA" : "NEE";
}

function statusTone(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes("betaald") && !lower.includes("niet")) return "good";
  if (lower.includes("hoog") || lower.includes("spoed") || lower.includes("nee")) return "danger";
  if (lower.includes("open") || lower.includes("behandeling") || lower.includes("loopt")) return "warn";
  return "neutral";
}

function App() {
  const [tab, setTab] = useState<Tab>("overzicht");
  const [query, setQuery] = useState("");
  const [balances, setBalances] = useStoredState<Balance[]>("aurawash-balances", initialBalances);
  const [salaries, setSalaries] = useStoredState<Salary[]>("aurawash-salaries", initialSalaries);
  const [taxes, setTaxes] = useStoredState<TaxItem[]>("aurawash-taxes", initialTaxes);
  const [fixedCosts, setFixedCosts] = useStoredState<FixedCost[]>("aurawash-fixed-costs", initialFixedCosts);
  const [payables, setPayables] = useStoredState<Payable[]>("aurawash-payables", initialPayables);
  const [receivables, setReceivables] = useStoredState<Receivable[]>("aurawash-receivables", initialReceivables);
  const [payrollDocs, setPayrollDocs] = useStoredState<PayrollDoc[]>("aurawash-payroll-docs", samplePayrollDocs);
  const [employee, setEmployee] = useState(initialSalaries[0]?.name ?? "");
  const [period, setPeriod] = useState("Mei 2026");
  const [newBalance, setNewBalance] = useState({ label: "", amount: "" });
  const [newSalary, setNewSalary] = useState({ name: "", total: "" });
  const [newPayable, setNewPayable] = useState({ company: "", invoice: "", amount: "", deadline: "" });
  const [newReceivable, setNewReceivable] = useState({ client: "", invoice: "", amount: "", dueDate: "" });
  const [newTax, setNewTax] = useState({ type: "", amount: "", deadline: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    const cash = sum(balances.map((item) => item.amount));
    const salary = sum(salaries.map((item) => item.total));
    const openTaxes = sum(
      taxes.filter((item) => isOpen(`${item.status} ${item.paid}`)).map((item) => item.amount),
    );
    const openPayables = sum(payables.filter((item) => isPaidNo(item.paid)).map((item) => item.amount));
    const expectedReceivables = sum(
      receivables.filter((item) => isPaidNo(item.paid)).map((item) => item.amount),
    );
    const fixedOpen = sum(fixedCosts.map((item) => Number(item.open || 0)));
    return { cash, salary, openTaxes, openPayables, expectedReceivables, fixedOpen };
  }, [balances, fixedCosts, payables, receivables, salaries, taxes]);

  const payrollCompletion = Math.round((payrollDocs.length / salaries.length) * 100);

  const filteredPayables = payables
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      [item.company, item.invoice, item.status, item.note, item.paid]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    );

  const filteredReceivables = receivables
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      [item.client, item.invoice, item.status, item.action, item.paid]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    );

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const additions = files.map((file, index): PayrollDoc => ({
      id: `${Date.now()}-${index}`,
      employee,
      period,
      fileName: file.name,
      uploadedAt: today,
      status: "Controle",
      gross: 0,
      net: 0,
    }));

    setPayrollDocs((current) => [...additions, ...current]);
    event.target.value = "";
  }

  function updatePayroll(id: string, patch: Partial<PayrollDoc>) {
    setPayrollDocs((current) =>
      current.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)),
    );
  }

  function removePayroll(id: string) {
    setPayrollDocs((current) => current.filter((doc) => doc.id !== id));
  }

  function addBalance() {
    const amount = Number(newBalance.amount);
    if (!newBalance.label.trim() || Number.isNaN(amount)) return;
    setBalances((current) => [...current, { label: newBalance.label.trim(), amount }]);
    setNewBalance({ label: "", amount: "" });
  }

  function addSalary() {
    const total = Number(newSalary.total);
    if (!newSalary.name.trim() || Number.isNaN(total)) return;
    setSalaries((current) => [
      ...current,
      { name: newSalary.name.trim(), salary: total, holidayPay: null, total },
    ]);
    setEmployee(newSalary.name.trim());
    setNewSalary({ name: "", total: "" });
  }

  function addTax() {
    const amount = Number(newTax.amount);
    if (!newTax.type.trim() || Number.isNaN(amount)) return;
    setTaxes((current) => [
      ...current,
      {
        type: newTax.type.trim(),
        amount,
        deadline: newTax.deadline.trim() || "-",
        arrangement: "NEE",
        priority: "Hoog",
        status: "open",
        paid: "NEE",
      },
    ]);
    setNewTax({ type: "", amount: "", deadline: "" });
  }

  function addPayable() {
    const amount = Number(newPayable.amount);
    if (!newPayable.company.trim() || Number.isNaN(amount)) return;
    setPayables((current) => [
      ...current,
      {
        company: newPayable.company.trim(),
        invoice: newPayable.invoice.trim() || "-",
        amount,
        deadline: newPayable.deadline.trim() || "-",
        priority: "Middel",
        status: "OPEN",
        note: "",
        paid: "NEE",
      },
    ]);
    setNewPayable({ company: "", invoice: "", amount: "", deadline: "" });
  }

  function addReceivable() {
    const amount = Number(newReceivable.amount);
    if (!newReceivable.client.trim() || Number.isNaN(amount)) return;
    setReceivables((current) => [
      ...current,
      {
        client: newReceivable.client.trim(),
        invoice: newReceivable.invoice.trim() || "-",
        amount,
        invoiceDate: today,
        dueDate: newReceivable.dueDate.trim(),
        status: "in behandeling",
        action: "opvolgen",
        paid: "NEE",
      },
    ]);
    setNewReceivable({ client: "", invoice: "", amount: "", dueDate: "" });
  }

  function resetToExcelStart() {
    setBalances(initialBalances);
    setSalaries(initialSalaries);
    setTaxes(initialTaxes);
    setFixedCosts(initialFixedCosts);
    setPayables(initialPayables);
    setReceivables(initialReceivables);
    setPayrollDocs(samplePayrollDocs);
  }

  const payrollRows: ExportRow[] = payrollDocs.map((doc) => ({
    medewerker: doc.employee,
    periode: doc.period,
    bestand: doc.fileName,
    status: doc.status,
    bruto: doc.gross,
    netto: doc.net,
    loonnummer: doc.payrollNumber ?? "",
    functie: doc.role ?? "",
    geupload_op: doc.uploadedAt,
  }));

  const institutionPacket = {
    generatedAt: new Date().toISOString(),
    sourceFiles: [
      "/Users/mac/Downloads/B&T _ AuraWash Overzicht Mei 2026.xlsx",
      "/Users/mac/Downloads/115 Murabe-A.--P07.pdf",
    ],
    payroll: payrollRows,
    salaries,
    taxes,
    fixedCosts,
    payables,
    receivables,
    totals,
  };

  function exportCsv(name: string, rows: ExportRow[]) {
    downloadFile(`${name}-${today}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  }

  function exportJson() {
    downloadFile(
      `aurawash-instanties-pakket-${today}.json`,
      JSON.stringify(institutionPacket, null, 2),
      "application/json;charset=utf-8",
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#f6f7f7]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-neutral-200 bg-white">
          <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-neutral-950">
                <img src={logoUrl} alt="AuraWash" className="max-h-10 max-w-10 object-contain invert" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-neutral-500">B&T x AuraWash</p>
                <h1 className="brand-display truncate text-2xl text-neutral-950 sm:text-3xl">
                  Administratie cockpit
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button variant="secondary" className="whitespace-nowrap" onClick={() => exportCsv("loonstroken", payrollRows)}>
                <FileSpreadsheet size={18} />
                <span className="hidden sm:inline">Loonstroken CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
              <Button variant="accent" className="whitespace-nowrap" onClick={exportJson}>
                <FileArchive size={18} />
                <span className="hidden sm:inline">Instanties pakket</span>
                <span className="sm:hidden">Pakket</span>
              </Button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-neutral-200 p-2">
            {[
              ["overzicht", Gauge, "Overzicht"],
              ["loonstroken", ReceiptText, "Loonstroken"],
              ["instanties", ClipboardList, "Instanties"],
              ["facturen", WalletCards, "Facturen"],
            ].map(([id, Icon, label]) => (
              <button
                key={id as string}
                onClick={() => setTab(id as Tab)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition",
                  tab === id
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "text-neutral-600 hover:bg-neutral-100",
                )}
                aria-pressed={tab === id}
              >
                <Icon size={17} />
                {label as string}
              </button>
            ))}
          </nav>
        </header>

        {tab === "overzicht" && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Metric title="Beschikbaar" value={euro.format(totals.cash)} detail="Rekeningen + contant" icon={Banknote} />
              <Metric title="Salarissen" value={euro.format(totals.salary)} detail={`${salaries.length} medewerkers`} icon={ReceiptText} />
              <Metric title="Belasting open" value={euro.format(totals.openTaxes)} detail="LB/BTW aandacht" icon={CalendarClock} danger />
              <Metric title="Facturen open" value={euro.format(totals.openPayables)} detail={`${payables.filter((p) => isPaidNo(p.paid)).length} kolom H = NEE`} icon={FolderUp} danger />
              <Metric title="Te ontvangen" value={euro.format(totals.expectedReceivables)} detail={`${receivables.filter((r) => isPaidNo(r.paid)).length} kolom J = NEE`} icon={ArrowDownToLine} />
              <Metric title="Vaste lasten" value={euro.format(totals.fixedOpen)} detail="Openstaand bedrag" icon={WalletCards} danger={totals.fixedOpen > 0} />
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.8fr_1fr]">
              <Card className="overflow-hidden">
                <SectionHeader title="Beschikbaar geld" note="Handmatig aanpasbaar" />
                <div className="grid divide-y divide-neutral-100">
                  {balances.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="grid gap-3 p-4 sm:grid-cols-[1fr_160px_44px] sm:items-center">
                      <Input
                        value={item.label}
                        onChange={(event) =>
                          setBalances((current) => updateIndex(current, index, { label: event.target.value }))
                        }
                        aria-label="Rekeningnaam"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={(event) =>
                          setBalances((current) => updateIndex(current, index, { amount: Number(event.target.value) }))
                        }
                        aria-label="Bedrag"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setBalances((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                        aria-label="Verwijder rekening"
                      >
                        <X size={18} />
                      </Button>
                    </div>
                  ))}
                  <div className="grid gap-3 bg-neutral-50 p-4 sm:grid-cols-[1fr_160px_120px] sm:items-center">
                    <Input
                      value={newBalance.label}
                      onChange={(event) => setNewBalance((current) => ({ ...current, label: event.target.value }))}
                      placeholder="Nieuwe rekening"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={newBalance.amount}
                      onChange={(event) => setNewBalance((current) => ({ ...current, amount: event.target.value }))}
                      placeholder="Bedrag"
                    />
                    <Button variant="accent" onClick={addBalance}>
                      <Plus size={18} />
                      Toevoegen
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <SectionHeader title="Vaste lasten" note="Status en openstaand bedrag" />
                <div className="table-scroll overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-neutral-950 text-white">
                      <tr>
                        <Th>Bedrijf</Th>
                        <Th>P/m</Th>
                        <Th>Automatisch</Th>
                        <Th>Status</Th>
                        <Th>Openstaand</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {fixedCosts.map((item, index) => (
                        <tr key={`${item.company}-${index}`}>
                          <Td className="font-semibold text-neutral-950">{item.company}</Td>
                          <Td>{euro.format(item.monthly ?? 0)}</Td>
                          <Td>{item.automatic}</Td>
                          <Td>
                            <Select
                              value={item.status}
                              onChange={(event) =>
                                setFixedCosts((current) => updateIndex(current, index, { status: event.target.value }))
                              }
                            >
                              <option>Actief</option>
                              <option>Open</option>
                              <option>Betaald</option>
                              <option>Stopzetten</option>
                            </Select>
                          </Td>
                          <Td>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.open ?? 0}
                              onChange={(event) =>
                                setFixedCosts((current) => updateIndex(current, index, { open: Number(event.target.value) }))
                              }
                              aria-label="Openstaand vaste last"
                            />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="overflow-hidden">
                <SectionHeader title="Mei 2026 salarisrun" note={`${payrollCompletion}% loonstroken gekoppeld`} />
                <div className="table-scroll overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-neutral-950 text-white">
                      <tr>
                        <Th>Medewerker</Th>
                        <Th>Salaris</Th>
                        <Th>Vakantiegeld</Th>
                        <Th>Totaal</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {salaries.map((salary, salaryIndex) => {
                        const linked = payrollDocs.some((doc) => doc.employee === salary.name);
                        return (
                          <tr key={salary.name} className="bg-white">
                            <Td className="font-semibold text-neutral-950">{salary.name}</Td>
                            <Td>
                              <Input
                                type="number"
                                step="0.01"
                                value={salary.salary}
                                onChange={(event) => {
                                  const salaryValue = Number(event.target.value);
                                  setSalaries((current) =>
                                    updateIndex(current, salaryIndex, {
                                      salary: salaryValue,
                                      total: salaryValue + (salary.holidayPay ?? 0),
                                    }),
                                  );
                                }}
                                aria-label={`Salaris ${salary.name}`}
                              />
                            </Td>
                            <Td>{salary.holidayPay ? euro.format(salary.holidayPay) : "-"}</Td>
                            <Td className="font-semibold">{euro.format(salary.total)}</Td>
                            <Td>
                              <Badge tone={linked ? "good" : "warn"}>
                                {linked ? "Loonstrook gekoppeld" : "Loonstrook ontbreekt"}
                              </Badge>
                            </Td>
                          </tr>
                        );
                      })}
                      <tr className="bg-neutral-50">
                        <Td>
                          <Input
                            value={newSalary.name}
                            onChange={(event) => setNewSalary((current) => ({ ...current, name: event.target.value }))}
                            placeholder="Nieuwe medewerker"
                          />
                        </Td>
                        <Td>
                          <Input
                            type="number"
                            step="0.01"
                            value={newSalary.total}
                            onChange={(event) => setNewSalary((current) => ({ ...current, total: event.target.value }))}
                            placeholder="Salaris"
                          />
                        </Td>
                        <Td>-</Td>
                        <Td>-</Td>
                        <Td>
                          <Button variant="accent" size="sm" onClick={addSalary}>
                            <Plus size={16} />
                            Toevoegen
                          </Button>
                        </Td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="overflow-hidden bg-neutral-950 text-white">
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#A7C7E7]">Controlelijst</p>
                      <h2 className="mt-1 text-xl font-bold">Klaarzetten voor instanties</h2>
                    </div>
                    <Badge tone="accent">{payrollDocs.length}/{salaries.length}</Badge>
                  </div>
                </div>
                <div className="divide-y divide-white/10">
                  {[
                    ["Salarissen uit Excel geladen", true],
                    ["Voorbeeldloonstrook herkend", true],
                    ["Alle loonstroken gekoppeld", payrollDocs.length >= salaries.length],
                    ["Open LB/BTW posten zichtbaar", true],
                    ["Exportpakket beschikbaar", true],
                  ].map(([label, done]) => (
                    <div key={label as string} className="flex items-center gap-3 p-4">
                      <CheckCircle2 className={done ? "text-[#A7C7E7]" : "text-white/25"} size={20} />
                      <span className={done ? "text-white" : "text-white/55"}>{label as string}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            <TaxPanel
              taxes={taxes}
              setTaxes={setTaxes}
              newTax={newTax}
              setNewTax={setNewTax}
              addTax={addTax}
            />
          </>
        )}

        {tab === "loonstroken" && (
          <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Loonstrook upload</h2>
                  <p className="mt-1 text-sm text-neutral-600">Koppel PDF-bestanden per medewerker en periode.</p>
                </div>
                <Upload className="text-neutral-400" />
              </div>

              <div className="mt-5 grid gap-4">
                <Field label="Medewerker">
                  <Select value={employee} onChange={(event) => setEmployee(event.target.value)}>
                    {salaries.map((salary) => (
                      <option key={salary.name}>{salary.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Periode">
                  <Input value={period} onChange={(event) => setPeriod(event.target.value)} />
                </Field>
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                  onChange={handleFiles}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 text-center transition hover:border-neutral-950 hover:bg-white"
                >
                  <FolderUp className="mx-auto mb-3 text-neutral-500" />
                  <span className="block font-semibold">Upload loonstrook</span>
                  <span className="mt-1 block text-sm text-neutral-500">PDF of afbeelding, meerdere tegelijk mogelijk</span>
                </button>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader title="Gekoppelde loonstroken" note={`${payrollDocs.length} documenten`} />
              <div className="grid divide-y divide-neutral-100">
                {payrollDocs.map((doc) => (
                  <article key={doc.id} className="grid gap-4 p-4 lg:grid-cols-[1.2fr_150px_150px_150px_190px_44px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileCheck2 size={18} className="text-neutral-500" />
                        <h3 className="truncate font-semibold text-neutral-950">{doc.fileName}</h3>
                        <Badge tone={doc.status === "Goedgekeurd" ? "good" : doc.status === "Afgekeurd" ? "danger" : "warn"}>{doc.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-neutral-600">
                        {doc.employee} · {doc.period}
                        {doc.payrollNumber ? ` · ${doc.payrollNumber}` : ""}
                      </p>
                    </div>

                    <Field label="Bruto">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={doc.gross}
                        onChange={(event) => updatePayroll(doc.id, { gross: Number(event.target.value) })}
                      />
                    </Field>
                    <Field label="Netto">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={doc.net}
                        onChange={(event) => updatePayroll(doc.id, { net: Number(event.target.value) })}
                      />
                    </Field>
                    <Select
                      value={doc.status}
                      onChange={(event) =>
                        updatePayroll(doc.id, { status: event.target.value as PayrollDoc["status"] })
                      }
                    >
                      <option>Controle</option>
                      <option>Goedgekeurd</option>
                      <option>Afgekeurd</option>
                      <option>Ontbreekt</option>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="accent" size="sm" onClick={() => updatePayroll(doc.id, { status: "Goedgekeurd" })}>
                        Goed
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => updatePayroll(doc.id, { status: "Afgekeurd" })}>
                        Afkeur
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removePayroll(doc.id)} aria-label="Verwijder loonstrook">
                      <X size={18} />
                    </Button>
                  </article>
                ))}
              </div>
            </Card>
          </section>
        )}

        {tab === "instanties" && (
          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <FileJson className="mt-1 text-neutral-500" />
                <div>
                  <h2 className="text-xl font-bold">Export voor instanties</h2>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">
                    Download losse CSV-bestanden of één JSON-pakket met salarissen, loonstroken,
                    belastingposten en facturen.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Button variant="accent" onClick={exportJson}>
                  <FileArchive size={18} />
                  Alles als JSON
                </Button>
                <Button variant="secondary" onClick={() => exportCsv("salarissen", salaries as unknown as ExportRow[])}>
                  <FileSpreadsheet size={18} />
                  Salarissen CSV
                </Button>
                <Button variant="secondary" onClick={() => exportCsv("beschikbaar-geld", balances as unknown as ExportRow[])}>
                  <FileSpreadsheet size={18} />
                  Beschikbaar CSV
                </Button>
                <Button variant="secondary" onClick={() => exportCsv("belastingen", taxes as unknown as ExportRow[])}>
                  <FileSpreadsheet size={18} />
                  Belastingen CSV
                </Button>
                <Button variant="secondary" onClick={() => exportCsv("vaste-lasten", fixedCosts as unknown as ExportRow[])}>
                  <FileSpreadsheet size={18} />
                  Vaste lasten CSV
                </Button>
                <Button variant="secondary" onClick={() => exportCsv("openstaande-facturen", payables as unknown as ExportRow[])}>
                  <FileSpreadsheet size={18} />
                  Facturen CSV
                </Button>
                <Button variant="secondary" onClick={() => exportCsv("te-ontvangen-facturen", receivables as unknown as ExportRow[])}>
                  <FileSpreadsheet size={18} />
                  Te ontvangen CSV
                </Button>
                <Button variant="danger" onClick={resetToExcelStart}>
                  <X size={18} />
                  Reset naar Excel
                </Button>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader title="Export-preview" note="Velden die meegaan" />
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <Preview label="Loonstroken" value={`${payrollDocs.length} documenten`} />
                <Preview label="Medewerkers" value={number.format(salaries.length)} />
                <Preview label="Open belasting" value={euro.format(totals.openTaxes)} />
                <Preview label="Open facturen" value={euro.format(totals.openPayables)} />
                <Preview label="Te ontvangen" value={euro.format(totals.expectedReceivables)} />
                <Preview label="Vaste lasten open" value={euro.format(totals.fixedOpen)} />
                <Preview label="Bron Excel" value="B&T _ AuraWash Overzicht Mei 2026.xlsx" wide />
                <Preview label="Voorbeeld PDF" value="115 Murabe-A.--P07.pdf" wide />
              </div>
            </Card>
          </section>
        )}

        {tab === "facturen" && (
          <section className="grid gap-5">
            <Card className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Facturen controle</h2>
                  <p className="text-sm text-neutral-600">Te betalen gebruikt kolom H. Te ontvangen gebruikt kolom J.</p>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek factuur" />
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader title="Te betalen facturen" note={`${payables.filter((p) => isPaidNo(p.paid)).length} open volgens kolom H`} />
              <div className="table-scroll overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-neutral-950 text-white">
                    <tr>
                      <Th>Bedrijf</Th>
                      <Th>Factuur</Th>
                      <Th>Bedrag</Th>
                      <Th>Deadline</Th>
                      <Th>Prioriteit</Th>
                      <Th>Status</Th>
                      <Th>Betaald H</Th>
                      <Th>Opmerking</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredPayables.map(({ item, index }) => (
                      <tr key={`${item.company}-${item.invoice}`}>
                        <Td className="font-semibold text-neutral-950">{item.company}</Td>
                        <Td>{item.invoice}</Td>
                        <Td>{euro.format(item.amount)}</Td>
                        <Td>{item.deadline}</Td>
                        <Td><Badge tone={statusTone(item.priority)}>{item.priority}</Badge></Td>
                        <Td>
                          <Select
                            value={item.status}
                            onChange={(event) =>
                              setPayables((current) => updateIndex(current, index, { status: event.target.value }))
                            }
                          >
                            <option>OPEN</option>
                            <option>Open</option>
                            <option>Betaald</option>
                            <option>in behandeling</option>
                          </Select>
                        </Td>
                        <Td>
                          <PaidSelect
                            value={item.paid}
                            onChange={(paid) =>
                              setPayables((current) =>
                                updateIndex(current, index, {
                                  paid,
                                  status: paid === "NEE" ? "OPEN" : "Betaald",
                                }),
                              )
                            }
                          />
                        </Td>
                        <Td className="max-w-[260px] truncate">{item.note || "-"}</Td>
                      </tr>
                    ))}
                    <tr className="bg-neutral-50">
                      <Td>
                        <Input
                          value={newPayable.company}
                          onChange={(event) => setNewPayable((current) => ({ ...current, company: event.target.value }))}
                          placeholder="Leverancier"
                        />
                      </Td>
                      <Td>
                        <Input
                          value={newPayable.invoice}
                          onChange={(event) => setNewPayable((current) => ({ ...current, invoice: event.target.value }))}
                          placeholder="Factuurnummer te betalen"
                        />
                      </Td>
                      <Td>
                        <Input
                          type="number"
                          step="0.01"
                          value={newPayable.amount}
                          onChange={(event) => setNewPayable((current) => ({ ...current, amount: event.target.value }))}
                          placeholder="Bedrag te betalen"
                        />
                      </Td>
                      <Td>
                        <Input
                          value={newPayable.deadline}
                          onChange={(event) => setNewPayable((current) => ({ ...current, deadline: event.target.value }))}
                          placeholder="Deadline"
                        />
                      </Td>
                      <Td><Badge tone="warn">Middel</Badge></Td>
                      <Td>OPEN</Td>
                      <Td><Badge tone="danger">NEE</Badge></Td>
                      <Td>
                        <Button variant="accent" size="sm" onClick={addPayable}>
                          <Plus size={16} />
                          Toevoegen
                        </Button>
                      </Td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader title="Te ontvangen facturen" note={`${receivables.filter((r) => isPaidNo(r.paid)).length} open volgens kolom J`} />
              <div className="table-scroll overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-neutral-950 text-white">
                    <tr>
                      <Th>Klant</Th>
                      <Th>Factuur</Th>
                      <Th>Bedrag</Th>
                      <Th>Factuurdatum</Th>
                      <Th>Vervaldatum</Th>
                      <Th>Status</Th>
                      <Th>Betaald J</Th>
                      <Th>Actie</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredReceivables.map(({ item, index }) => (
                      <tr key={`${item.client}-${item.invoice}`}>
                        <Td className="font-semibold text-neutral-950">{item.client}</Td>
                        <Td>{item.invoice}</Td>
                        <Td>{euro.format(item.amount)}</Td>
                        <Td>{item.invoiceDate || "-"}</Td>
                        <Td>{item.dueDate || "-"}</Td>
                        <Td>
                          <Select
                            value={item.status}
                            onChange={(event) =>
                              setReceivables((current) => updateIndex(current, index, { status: event.target.value }))
                            }
                          >
                            <option>in behandeling</option>
                            <option>Betaald</option>
                            <option>Open</option>
                          </Select>
                        </Td>
                        <Td>
                          <PaidSelect
                            value={item.paid}
                            onChange={(paid) =>
                              setReceivables((current) =>
                                updateIndex(current, index, {
                                  paid,
                                  status: paid === "NEE" ? "in behandeling" : "Betaald",
                                }),
                              )
                            }
                          />
                        </Td>
                        <Td className="max-w-[260px] truncate">{item.action || "-"}</Td>
                      </tr>
                    ))}
                    <tr className="bg-neutral-50">
                      <Td>
                        <Input
                          value={newReceivable.client}
                          onChange={(event) => setNewReceivable((current) => ({ ...current, client: event.target.value }))}
                          placeholder="Klant"
                        />
                      </Td>
                      <Td>
                        <Input
                          value={newReceivable.invoice}
                          onChange={(event) => setNewReceivable((current) => ({ ...current, invoice: event.target.value }))}
                          placeholder="Factuurnummer te ontvangen"
                        />
                      </Td>
                      <Td>
                        <Input
                          type="number"
                          step="0.01"
                          value={newReceivable.amount}
                          onChange={(event) => setNewReceivable((current) => ({ ...current, amount: event.target.value }))}
                          placeholder="Bedrag te ontvangen"
                        />
                      </Td>
                      <Td>{today}</Td>
                      <Td>
                        <Input
                          value={newReceivable.dueDate}
                          onChange={(event) => setNewReceivable((current) => ({ ...current, dueDate: event.target.value }))}
                          placeholder="Vervaldatum"
                        />
                      </Td>
                      <Td>in behandeling</Td>
                      <Td><Badge tone="danger">NEE</Badge></Td>
                      <Td>
                        <Button variant="accent" size="sm" onClick={addReceivable}>
                          <Plus size={16} />
                          Toevoegen
                        </Button>
                      </Td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({
  title,
  value,
  detail,
  icon: Icon,
  danger = false,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Banknote;
  danger?: boolean;
}) {
  return (
    <Card className={cn("p-4", danger && "border-red-200 bg-red-50")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-neutral-950">{value}</p>
          <p className="mt-1 text-sm text-neutral-600">{detail}</p>
        </div>
        <div className={cn("rounded-md p-2", danger ? "bg-red-100 text-red-700" : "bg-[#A7C7E7]/45 text-neutral-950")}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

function TaxPanel({
  taxes,
  setTaxes,
  newTax,
  setNewTax,
  addTax,
}: {
  taxes: TaxItem[];
  setTaxes: (next: TaxItem[] | ((current: TaxItem[]) => TaxItem[])) => void;
  newTax: { type: string; amount: string; deadline: string };
  setNewTax: (next: { type: string; amount: string; deadline: string } | ((current: { type: string; amount: string; deadline: string }) => { type: string; amount: string; deadline: string })) => void;
  addTax: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader title="Belastingen en deadlines" note={`${taxes.length} posten uit Excel`} />
      <div className="table-scroll overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-neutral-950 text-white">
            <tr>
              <Th>Soort</Th>
              <Th>Bedrag</Th>
              <Th>Deadline</Th>
              <Th>Regeling</Th>
              <Th>Prioriteit</Th>
              <Th>Status</Th>
              <Th>Betaald</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {taxes.map((item, index) => (
              <tr key={item.type}>
                <Td className="font-semibold text-neutral-950">{item.type}</Td>
                <Td>{euro.format(item.amount)}</Td>
                <Td>{item.deadline}</Td>
                <Td>{item.arrangement}</Td>
                <Td><Badge tone={statusTone(item.priority)}>{item.priority}</Badge></Td>
                <Td>
                  <Select
                    value={item.status}
                    onChange={(event) =>
                      setTaxes((current) => updateIndex(current, index, { status: event.target.value }))
                    }
                  >
                    <option>open</option>
                    <option>loopt</option>
                    <option>niet betaald</option>
                    <option>Betaald</option>
                  </Select>
                </Td>
                <Td>
                  <PaidSelect
                    value={item.paid}
                    onChange={(paid) =>
                      setTaxes((current) =>
                        updateIndex(current, index, {
                          paid,
                          status: paid === "NEE" ? "niet betaald" : paid === "JA" ? "Betaald" : "loopt",
                        }),
                      )
                    }
                  />
                </Td>
              </tr>
            ))}
            <tr className="bg-neutral-50">
              <Td>
                <Input
                  value={newTax.type}
                  onChange={(event) => setNewTax((current) => ({ ...current, type: event.target.value }))}
                  placeholder="Nieuwe belastingpost"
                />
              </Td>
              <Td>
                <Input
                  type="number"
                  step="0.01"
                  value={newTax.amount}
                  onChange={(event) => setNewTax((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="Bedrag"
                />
              </Td>
              <Td>
                <Input
                  value={newTax.deadline}
                  onChange={(event) => setNewTax((current) => ({ ...current, deadline: event.target.value }))}
                  placeholder="Deadline"
                />
              </Td>
              <Td>NEE</Td>
              <Td><Badge tone="danger">Hoog</Badge></Td>
              <Td>open</Td>
              <Td>
                <Button variant="accent" size="sm" onClick={addTax}>
                  <Plus size={16} />
                  Toevoegen
                </Button>
              </Td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function PaidSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: PaidValue) => void;
}) {
  const paid = normalizePaid(value);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant={paid === "JA" || paid === "JA (termijn)" ? "accent" : "secondary"}
        size="sm"
        onClick={() => onChange("JA")}
      >
        JA
      </Button>
      <Button
        type="button"
        variant={paid === "NEE" ? "danger" : "secondary"}
        size="sm"
        onClick={() => onChange("NEE")}
      >
        NEE
      </Button>
    </div>
  );
}

function SectionHeader({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 p-5 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-bold text-neutral-950">{title}</h2>
      <span className="text-sm font-medium text-neutral-500">{note}</span>
    </div>
  );
}

function Preview({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-md border border-neutral-200 bg-neutral-50 p-4", wide && "sm:col-span-2")}>
      <p className="text-xs font-semibold uppercase text-neutral-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-semibold uppercase text-white/80">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-neutral-700", className)}>{children}</td>;
}

export default App;
