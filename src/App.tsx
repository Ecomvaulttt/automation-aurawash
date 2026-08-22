import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  Banknote,
  BarChart3,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  FileArchive,
  FileCheck2,
  FileJson,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FolderUp,
  Gauge,
  Landmark,
  LockKeyhole,
  Mail,
  MessageSquareWarning,
  Palette,
  PlugZap,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  TimerReset,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { SkyToggle } from "./components/ui/sky-toggle";
import {
  balances as initialBalances,
  fixedCosts as initialFixedCosts,
  payables as initialPayables,
  PayrollDoc,
  InvoiceDocument,
  receivables as initialReceivables,
  salaries as initialSalaries,
  sampleInvoiceDocuments,
  samplePayrollDocs,
  taxes as initialTaxes,
  Salary,
  TaxItem,
  Payable,
  Receivable,
} from "./data";
import { downloadFile, ExportRow, toCsv } from "./lib/export";
import { cn } from "./lib/utils";

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const number = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 0,
});

const today = new Date().toISOString().slice(0, 10);
const githubActionsUrl =
  "https://github.com/Ecomvaulttt/automation-aurawash/actions/workflows/send-email.yml";

type Tab = "onboarding" | "overzicht" | "loonstroken" | "instanties" | "facturen" | "automation" | "email";
type ThemeMode = "light" | "dark";
type PaidValue = "JA" | "NEE" | "JA (termijn)";
type Balance = (typeof initialBalances)[number];
type FixedCost = (typeof initialFixedCosts)[number];
type DocumentType = InvoiceDocument["type"];
type PeriodView = "maand" | "kwartaal" | "jaar";
type MetricKey = "cash" | "salary" | "tax" | "payables" | "receivables" | "fixed";
type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "thisMonth"
  | "last30"
  | "last90"
  | "thisQuarter"
  | "halfYear"
  | "year"
  | "last365"
  | "total"
  | "custom";

type DateRangeState = {
  preset: DateRangePreset;
  start: string;
  end: string;
};

type ClientProfile = {
  companyName: string;
  sector: string;
  contactName: string;
  adminEmail: string;
  bookkeeperEmail: string;
  slackChannel: string;
  logoUrl: string;
  brandColor: string;
  bankUploadCadence: string;
  lastBankUpload: string;
};

type InvoiceDraft = {
  client: string;
  email: string;
  invoiceNumber: string;
  description: string;
  amount: string;
  dueDate: string;
};

type FinancialMetric = {
  key: MetricKey;
  title: string;
  value: number;
  detail: string;
  icon: typeof Banknote;
  danger?: boolean;
};

const dateRangePresets: Array<{ key: DateRangePreset; label: string }> = [
  { key: "today", label: "Vandaag" },
  { key: "yesterday", label: "Gister" },
  { key: "last7", label: "Laatste 7 dagen" },
  { key: "thisMonth", label: "Deze maand" },
  { key: "last30", label: "Laatste 30 dagen" },
  { key: "last90", label: "Laatste 90 dagen" },
  { key: "thisQuarter", label: "Dit kwartaal" },
  { key: "halfYear", label: "Halfjaar" },
  { key: "year", label: "Jaar" },
  { key: "last365", label: "Laatste 365 dagen" },
  { key: "total", label: "Totaal" },
];

type AutomationSettings = {
  gmailAccount: string;
  gmailQuery: string;
  slackChannel: string;
  payableReminderDays: number;
  receivableReminderDays: number;
  autoCustomerEmail: boolean;
};

type ReminderItem = {
  id: string;
  kind: "te-betalen" | "te-ontvangen";
  relation: string;
  invoice: string;
  amount: number;
  dueDate: string;
  daysLeft: number | null;
  urgency: "overdue" | "due" | "missing-date";
  action: string;
};

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

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function buildDateRange(preset: DateRangePreset): DateRangeState {
  const now = parseIsoDate(today) ?? new Date();
  if (preset === "today") return { preset, start: today, end: today };
  if (preset === "yesterday") {
    const yesterday = toIsoDate(addDays(now, -1));
    return { preset, start: yesterday, end: yesterday };
  }
  if (preset === "last7") return { preset, start: toIsoDate(addDays(now, -6)), end: today };
  if (preset === "thisMonth") return { preset, start: toIsoDate(startOfMonth(now)), end: today };
  if (preset === "last30") return { preset, start: toIsoDate(addDays(now, -29)), end: today };
  if (preset === "last90") return { preset, start: toIsoDate(addDays(now, -89)), end: today };
  if (preset === "thisQuarter") return { preset, start: toIsoDate(startOfQuarter(now)), end: today };
  if (preset === "halfYear") return { preset, start: toIsoDate(addDays(now, -182)), end: today };
  if (preset === "year") return { preset, start: toIsoDate(startOfYear(now)), end: today };
  if (preset === "last365") return { preset, start: toIsoDate(addDays(now, -364)), end: today };
  return { preset: "total", start: "", end: "" };
}

function dateInRange(value: string, range: DateRangeState) {
  if (range.preset === "total") return true;
  const date = parseIsoDate(value);
  const start = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

function dateRangeLabel(range: DateRangeState) {
  if (range.preset === "total") return "Alle beschikbare data";
  const preset = dateRangePresets.find((item) => item.key === range.preset);
  return `${preset?.label ?? "Aangepast"} · ${range.start || "-"} t/m ${range.end || "-"}`;
}

function daysUntil(value: string) {
  const date = parseIsoDate(value);
  if (!date) return null;
  const start = new Date(`${today}T00:00:00`);
  return Math.ceil((date.getTime() - start.getTime()) / 86_400_000);
}

function normalizePaid(value: string): PaidValue {
  return value.includes("termijn") ? "JA (termijn)" : value.trim().toUpperCase() === "JA" ? "JA" : "NEE";
}

function isActiveEmployee(salary: Salary) {
  return salary.status !== "Uit dienst";
}

function statusTone(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes("betaald") && !lower.includes("niet")) return "good";
  if (lower.includes("hoog") || lower.includes("spoed") || lower.includes("nee")) return "danger";
  if (lower.includes("open") || lower.includes("behandeling") || lower.includes("loopt")) return "warn";
  return "neutral";
}

function buildReminders(
  payables: Payable[],
  receivables: Receivable[],
  payableDays: number,
  receivableDays: number,
): ReminderItem[] {
  const payableAlerts = payables
    .filter((item) => isPaidNo(item.paid))
    .map((item): ReminderItem | null => {
      const left = daysUntil(item.deadline);
      if (left === null) {
        return {
          id: `payable-${item.invoice}`,
          kind: "te-betalen",
          relation: item.company,
          invoice: item.invoice,
          amount: item.amount,
          dueDate: item.deadline,
          daysLeft: null,
          urgency: "missing-date",
          action: "Datum handmatig controleren",
        };
      }
      if (left > payableDays) return null;
      return {
        id: `payable-${item.invoice}`,
        kind: "te-betalen",
        relation: item.company,
        invoice: item.invoice,
        amount: item.amount,
        dueDate: item.deadline,
        daysLeft: left,
        urgency: left < 0 ? "overdue" : "due",
        action: "Slack melding naar intern team",
      };
    })
    .filter(Boolean) as ReminderItem[];

  const receivableAlerts = receivables
    .filter((item) => isPaidNo(item.paid))
    .map((item): ReminderItem | null => {
      const left = daysUntil(item.dueDate);
      if (left === null) {
        return {
          id: `receivable-${item.invoice}`,
          kind: "te-ontvangen",
          relation: item.client,
          invoice: item.invoice,
          amount: item.amount,
          dueDate: item.dueDate || "-",
          daysLeft: null,
          urgency: "missing-date",
          action: "Vervaldatum toevoegen voor automatische klantmail",
        };
      }
      if (left > receivableDays) return null;
      return {
        id: `receivable-${item.invoice}`,
        kind: "te-ontvangen",
        relation: item.client,
        invoice: item.invoice,
        amount: item.amount,
        dueDate: item.dueDate,
        daysLeft: left,
        urgency: left < 0 ? "overdue" : "due",
        action: "Slack melding + klantmail als betaling ontbreekt",
      };
    })
    .filter(Boolean) as ReminderItem[];

  return [...payableAlerts, ...receivableAlerts].sort((a, b) => {
    const aDays = a.daysLeft ?? 9999;
    const bDays = b.daysLeft ?? 9999;
    return aDays - bDays;
  });
}

function clampPercent(value: number, max: number) {
  if (!max) return 0;
  return Math.max(6, Math.min(100, Math.round((value / max) * 100)));
}

function periodLabel(period: PeriodView) {
  if (period === "kwartaal") return "Kwartaal";
  if (period === "jaar") return "Jaar";
  return "Maand";
}

function connectorStatus(settings: AutomationSettings, profile: ClientProfile) {
  return [
    { label: "Gmail inbox", done: Boolean(settings.gmailAccount), detail: settings.gmailAccount || "Nog niet verbonden" },
    { label: "Slack kanaal", done: Boolean(settings.slackChannel), detail: settings.slackChannel || "Nog niet gekozen" },
    { label: "Boekhouder", done: Boolean(profile.bookkeeperEmail), detail: profile.bookkeeperEmail || "E-mail ontbreekt" },
    { label: "Bankbestand", done: Boolean(profile.lastBankUpload), detail: profile.lastBankUpload || "Upload CSV/XLS van 30 dagen" },
    { label: "Klantbranding", done: Boolean(profile.companyName && profile.logoUrl), detail: profile.companyName || "Bedrijfsnaam/logo" },
  ];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function App() {
  const [tab, setTab] = useState<Tab>("onboarding");
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useStoredState<ThemeMode>("ecomvault-theme", "light");
  const [periodView, setPeriodView] = useStoredState<PeriodView>("ecomvault-period-view", "maand");
  const [selectedMetric, setSelectedMetric] = useStoredState<MetricKey>("ecomvault-selected-metric", "cash");
  const [dateRange, setDateRange] = useStoredState<DateRangeState>("ecomvault-date-range", buildDateRange("total"));
  const [clientProfile, setClientProfile] = useStoredState<ClientProfile>("ecomvault-client-profile", {
    companyName: "AuraWash",
    sector: "Autodetailing / carwash",
    contactName: "Ramzi",
    adminEmail: "administratie@aurawash.nl",
    bookkeeperEmail: "",
    slackChannel: "#administratie",
    logoUrl: "https://aurawash.nl/cdn/shop/files/logo_top_site.png?v=1770326175&width=360",
    brandColor: "#2D5BFF",
    bankUploadCadence: "Elke 30 dagen",
    lastBankUpload: "",
  });
  const [balances, setBalances] = useStoredState<Balance[]>("aurawash-balances", initialBalances);
  const [salaries, setSalaries] = useStoredState<Salary[]>("aurawash-salaries", initialSalaries);
  const [taxes, setTaxes] = useStoredState<TaxItem[]>("aurawash-taxes", initialTaxes);
  const [fixedCosts, setFixedCosts] = useStoredState<FixedCost[]>("aurawash-fixed-costs", initialFixedCosts);
  const [payables, setPayables] = useStoredState<Payable[]>("aurawash-payables", initialPayables);
  const [receivables, setReceivables] = useStoredState<Receivable[]>("aurawash-receivables", initialReceivables);
  const [payrollDocs, setPayrollDocs] = useStoredState<PayrollDoc[]>("aurawash-payroll-docs", samplePayrollDocs);
  const [invoiceDocs, setInvoiceDocs] = useStoredState<InvoiceDocument[]>("aurawash-invoice-documents", sampleInvoiceDocuments);
  const [automationSettings, setAutomationSettings] = useStoredState<AutomationSettings>("aurawash-automation-settings", {
    gmailAccount: "info@ecomvault.nl",
    gmailQuery: "has:attachment (factuur OR invoice OR loonstrook OR salaris)",
    slackChannel: "#administratie",
    payableReminderDays: 5,
    receivableReminderDays: 3,
    autoCustomerEmail: true,
  });
  const [employee, setEmployee] = useState(initialSalaries[0]?.name ?? "");
  const [period, setPeriod] = useState("Mei 2026");
  const [selectedPayrollEmployee, setSelectedPayrollEmployee] = useStoredState("ecomvault-payroll-employee", initialSalaries[0]?.name ?? "");
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useStoredState("ecomvault-payroll-month", "Alle maanden");
  const [newBalance, setNewBalance] = useState({ label: "", amount: "" });
  const [newSalary, setNewSalary] = useState({ name: "", total: "" });
  const [newPayable, setNewPayable] = useState({ company: "", invoice: "", amount: "", deadline: "" });
  const [newReceivable, setNewReceivable] = useState({ client: "", invoice: "", amount: "", dueDate: "" });
  const [newTax, setNewTax] = useState({ type: "", amount: "", deadline: "" });
  const [selectedDocId, setSelectedDocId] = useState(sampleInvoiceDocuments[0]?.id ?? "");
  const [newDocument, setNewDocument] = useState({
    type: "te-betalen" as DocumentType,
    relation: "",
    invoiceNumber: "",
    amount: "",
    dueDate: "",
    customerEmail: "",
  });
  const [invoiceDraft, setInvoiceDraft] = useStoredState<InvoiceDraft>("ecomvault-invoice-draft", {
    client: "Udenhout",
    email: "",
    invoiceNumber: `EV-${today.replaceAll("-", "")}`,
    description: "Detailing services",
    amount: "",
    dueDate: today,
  });
  const [emailDraft, setEmailDraft] = useStoredState("aurawash-email-draft", {
    to: "",
    subject: "AuraWash administratie update",
    body: "Hi,\n\nDe AuraWash administratie is bijgewerkt. De actuele loonstroken, facturen en betaalstatussen staan klaar in het exportpakket.\n\nGroet,\nAuraWash",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const invoiceFileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bankInputRef = useRef<HTMLInputElement>(null);
  const activeSalaries = salaries.filter(isActiveEmployee);

  const totals = useMemo(() => {
    const cash = sum(balances.map((item) => item.amount));
    const salary = sum(salaries.filter(isActiveEmployee).map((item) => item.total));
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

  const reminders = useMemo(
    () =>
      buildReminders(
        payables,
        receivables,
        automationSettings.payableReminderDays,
        automationSettings.receivableReminderDays,
      ),
    [automationSettings.payableReminderDays, automationSettings.receivableReminderDays, payables, receivables],
  );

  const rangedPayables = payables.filter((item) => dateInRange(item.deadline, dateRange));
  const rangedReceivables = receivables.filter((item) => dateInRange(item.dueDate || item.invoiceDate, dateRange));
  const rangedPayrollDocs = payrollDocs.filter((doc) => dateInRange(doc.uploadedAt, dateRange));
  const rangedInvoiceDocs = invoiceDocs.filter((doc) => dateInRange(doc.dueDate || doc.receivedAt, dateRange));
  const rangedTaxes = taxes.filter((item) => dateInRange(item.deadline, dateRange));
  const displayedPayables = dateRange.preset === "total" ? payables : rangedPayables;
  const displayedReceivables = dateRange.preset === "total" ? receivables : rangedReceivables;
  const displayedPayrollDocs = dateRange.preset === "total" ? payrollDocs : rangedPayrollDocs;
  const displayedInvoiceDocs = dateRange.preset === "total" ? invoiceDocs : rangedInvoiceDocs;
  const displayedTaxes = dateRange.preset === "total" ? taxes : rangedTaxes;

  const displayTotals = {
    cash: totals.cash,
    salary:
      dateRange.preset === "total"
        ? totals.salary
        : sum(displayedPayrollDocs.map((doc) => doc.net || doc.gross || 0)),
    openTaxes: sum(
      displayedTaxes.filter((item) => isOpen(`${item.status} ${item.paid}`)).map((item) => item.amount),
    ),
    openPayables: sum(displayedPayables.filter((item) => isPaidNo(item.paid)).map((item) => item.amount)),
    expectedReceivables: sum(displayedReceivables.filter((item) => isPaidNo(item.paid)).map((item) => item.amount)),
    fixedOpen: dateRange.preset === "total" ? totals.fixedOpen : sum(displayedInvoiceDocs.filter((doc) => doc.type === "vaste-last" && doc.paid === "NEE").map((doc) => doc.amount)),
  };

  const financialMetrics: FinancialMetric[] = [
    {
      key: "cash",
      title: "Beschikbaar",
      value: displayTotals.cash,
      detail: "Rekeningen + contant",
      icon: Banknote,
    },
    {
      key: "salary",
      title: "Salarissen",
      value: displayTotals.salary,
      detail: dateRange.preset === "total" ? `${activeSalaries.length} actieve medewerkers` : `${displayedPayrollDocs.length} loonstroken`,
      icon: ReceiptText,
    },
    {
      key: "tax",
      title: "Belasting open",
      value: displayTotals.openTaxes,
      detail: "LB/BTW aandacht",
      icon: CalendarClock,
      danger: displayTotals.openTaxes > 0,
    },
    {
      key: "payables",
      title: "Facturen open",
      value: displayTotals.openPayables,
      detail: `${displayedPayables.filter((p) => isPaidNo(p.paid)).length} kolom H = NEE`,
      icon: FolderUp,
      danger: displayTotals.openPayables > 0,
    },
    {
      key: "receivables",
      title: "Te ontvangen",
      value: displayTotals.expectedReceivables,
      detail: `${displayedReceivables.filter((r) => isPaidNo(r.paid)).length} kolom J = NEE`,
      icon: ArrowDownToLine,
    },
    {
      key: "fixed",
      title: "Vaste lasten",
      value: displayTotals.fixedOpen,
      detail: "Openstaand bedrag",
      icon: WalletCards,
      danger: displayTotals.fixedOpen > 0,
    },
  ];

  const selectedFinancialMetric =
    financialMetrics.find((metric) => metric.key === selectedMetric) ?? financialMetrics[0];
  const periodFactor = periodView === "jaar" ? 12 : periodView === "kwartaal" ? 3 : 1;
  const chartRows = [
    { label: "Nu", value: selectedFinancialMetric.value },
    { label: "Vorige", value: Math.max(0, selectedFinancialMetric.value * 0.86) },
    { label: periodLabel(periodView), value: selectedFinancialMetric.value * periodFactor },
  ];
  const chartMax = Math.max(...chartRows.map((row) => row.value), 1);
  const connectorChecklist = connectorStatus(automationSettings, clientProfile);
  const onboardingProgress = Math.round(
    (connectorChecklist.filter((item) => item.done).length / connectorChecklist.length) * 100,
  );
  const cashCoverage =
    displayTotals.cash -
    displayTotals.salary -
    displayTotals.openTaxes -
    displayTotals.openPayables -
    displayTotals.fixedOpen;

  const selectedDoc = invoiceDocs.find((doc) => doc.id === selectedDocId) ?? invoiceDocs[0];
  const linkedDocumentCount = invoiceDocs.filter((doc) => doc.linkedInvoice).length;

  const linkedActiveEmployees = activeSalaries.filter((salary) =>
    payrollDocs.some((doc) => doc.employee === salary.name),
  );
  const payrollCompletion = activeSalaries.length
    ? Math.round((linkedActiveEmployees.length / activeSalaries.length) * 100)
    : 0;
  const proofCoverage = invoiceDocs.length
    ? Math.round((linkedDocumentCount / invoiceDocs.length) * 100)
    : 0;
  const systemScore = Math.round((onboardingProgress + payrollCompletion + proofCoverage) / 3);
  const nextReminder = reminders[0];

  const payrollMonths = Array.from(new Set(payrollDocs.map((doc) => doc.period))).filter(Boolean);
  const selectedPayrollProfile =
    salaries.find((salary) => salary.name === selectedPayrollEmployee) ?? salaries[0];
  const payrollProfileDocs = payrollDocs.filter((doc) => doc.employee === selectedPayrollProfile?.name);
  const filteredPayrollProfileDocs = payrollProfileDocs.filter((doc) =>
    selectedPayrollMonth === "Alle maanden" ? true : doc.period === selectedPayrollMonth,
  );

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
    const selectedEmployee = employee || activeSalaries[0]?.name;
    if (!selectedEmployee) return;

    const additions = files.map((file, index): PayrollDoc => ({
      id: `${Date.now()}-${index}`,
      employee: selectedEmployee,
      period,
      fileName: file.name,
      uploadedAt: today,
      status: "Controle",
      gross: 0,
      net: 0,
    }));

    setPayrollDocs((current) => [...additions, ...current]);
    setSelectedPayrollEmployee(selectedEmployee);
    setSelectedPayrollMonth(period);
    event.target.value = "";
  }

  function handleInvoiceFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const additions = files.map((file, index): InvoiceDocument => {
      const invoiceNumber = newDocument.invoiceNumber.trim() || file.name.replace(/\.[^.]+$/, "");
      const relation = newDocument.relation.trim() || "Onbekend";
      const amount = Number(newDocument.amount);
      const type = newDocument.type;
      const paid = "NEE";
      return {
        id: `uploaded-doc-${Date.now()}-${index}`,
        type,
        source: "upload",
        direction: type === "te-betalen" || type === "vaste-last" ? "inkomend" : "uitgaand",
        relation,
        invoiceNumber,
        subject: `${relation} ${invoiceNumber}`,
        sender: type === "te-ontvangen" ? "AuraWash" : relation,
        customerEmail: newDocument.customerEmail.trim() || undefined,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        receivedAt: today,
        dueDate: newDocument.dueDate.trim(),
        amount: Number.isNaN(amount) ? 0 : amount,
        paid,
        status: "Controle",
        category: type === "vaste-last" ? "Vaste lasten" : type === "loonstrook" ? "Loonstrook" : "Factuur",
        extractedText: "Handmatig geupload. Controleer bedrag, relatie, factuurnummer en vervaldatum.",
        previewUrl: URL.createObjectURL(file),
        linkedInvoice: invoiceNumber,
      };
    });

    setInvoiceDocs((current) => [...additions, ...current]);
    setSelectedDocId(additions[0]?.id ?? selectedDocId);
    event.target.value = "";
  }

  function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setClientProfile((current) => ({ ...current, logoUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleBankUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const label = `${today} · ${file.name}`;
    setClientProfile((current) => ({ ...current, lastBankUpload: label }));
    setBalances((current) => [
      { label: "Bankbestand 30 dagen", amount: totals.cash },
      ...current.filter((item) => item.label !== "Bankbestand 30 dagen"),
    ]);
    event.target.value = "";
  }

  function exportBrandedInvoice() {
    const amount = Number(invoiceDraft.amount);
    const invoiceTotal = Number.isNaN(amount) ? 0 : amount;
    const html = `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>Factuur ${escapeHtml(invoiceDraft.invoiceNumber)}</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#F5F2ED;color:#0B0B0C;margin:0;padding:48px}
    .page{max-width:860px;margin:0 auto;background:white;border:1px solid #E8D9B8;padding:48px}
    .top{display:flex;justify-content:space-between;gap:32px;align-items:flex-start;border-bottom:1px solid #E8D9B8;padding-bottom:32px}
    img{max-height:72px;max-width:180px;object-fit:contain}
    h1{font-size:48px;line-height:1;margin:0 0 12px;font-weight:700;letter-spacing:-.02em}
    table{width:100%;border-collapse:collapse;margin-top:36px}
    th,td{text-align:left;border-bottom:1px solid #EAE6DE;padding:14px}
    th{font-size:12px;text-transform:uppercase;color:#555}
    .total{font-size:28px;font-weight:700;color:${escapeHtml(clientProfile.brandColor)}}
    .muted{color:#555}
  </style>
</head>
<body>
  <main class="page">
    <section class="top">
      <div>
        ${clientProfile.logoUrl ? `<img src="${escapeHtml(clientProfile.logoUrl)}" alt="${escapeHtml(clientProfile.companyName)}" />` : ""}
        <h1>Factuur</h1>
        <p class="muted">${escapeHtml(clientProfile.companyName)} · ${escapeHtml(clientProfile.sector)}</p>
      </div>
      <div>
        <strong>${escapeHtml(invoiceDraft.invoiceNumber)}</strong><br/>
        Factuurdatum: ${today}<br/>
        Vervaldatum: ${escapeHtml(invoiceDraft.dueDate)}
      </div>
    </section>
    <section>
      <p><strong>Aan:</strong> ${escapeHtml(invoiceDraft.client)}${invoiceDraft.email ? ` · ${escapeHtml(invoiceDraft.email)}` : ""}</p>
      <table>
        <thead><tr><th>Omschrijving</th><th>Bedrag</th></tr></thead>
        <tbody><tr><td>${escapeHtml(invoiceDraft.description)}</td><td>${euro.format(invoiceTotal)}</td></tr></tbody>
      </table>
      <p class="total">Totaal ${euro.format(invoiceTotal)}</p>
      <p class="muted">Gegenereerd vanuit EcomVault Ops Cockpit.</p>
    </section>
  </main>
</body>
</html>`;
    downloadFile(`factuur-${invoiceDraft.invoiceNumber || today}.html`, html, "text/html;charset=utf-8");
  }

  function exportAccountantReport() {
    const rows = financialMetrics
      .map((metric) => `<tr><td>${escapeHtml(metric.title)}</td><td>${euro.format(metric.value)}</td><td>${escapeHtml(metric.detail)}</td></tr>`)
      .join("");
    const evidenceRows = invoiceDocs
      .map(
        (doc) =>
          `<tr><td>${escapeHtml(doc.type)}</td><td>${escapeHtml(doc.relation)}</td><td>${escapeHtml(doc.invoiceNumber)}</td><td>${euro.format(doc.amount)}</td><td>${escapeHtml(doc.paid)}</td><td>${escapeHtml(doc.storagePath || doc.fileName)}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(clientProfile.companyName)} boekhouderpakket</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#F5F2ED;color:#0B0B0C;margin:0;padding:40px}
    main{max-width:1120px;margin:0 auto;background:white;border:1px solid #E8D9B8;padding:40px}
    h1{font-size:44px;letter-spacing:-.02em;margin:0 0 8px}
    h2{margin-top:36px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{text-align:left;border-bottom:1px solid #EAE6DE;padding:10px;font-size:14px;vertical-align:top}
    th{font-size:12px;text-transform:uppercase;color:#555}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px}
    .box{border:1px solid #E8D9B8;padding:16px;background:#F5F2ED}
    .mono{font-family:ui-monospace,Menlo,monospace}
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(clientProfile.companyName)} boekhouderpakket</h1>
    <p>Gegenereerd op ${today}. Periode: ${escapeHtml(dateRangeLabel(dateRange))}. Weergave: ${periodLabel(periodView)}. Bewijsstukken staan als opslagpad/bestandsnaam in dit pakket.</p>
    <section class="grid">
      <div class="box"><strong>Beschikbaar</strong><br/><span class="mono">${euro.format(totals.cash)}</span></div>
      <div class="box"><strong>Cashflow ruimte</strong><br/><span class="mono">${euro.format(cashCoverage)}</span></div>
      <div class="box"><strong>Open kosten</strong><br/><span class="mono">${euro.format(totals.openPayables + totals.fixedOpen + totals.openTaxes)}</span></div>
      <div class="box"><strong>Te ontvangen</strong><br/><span class="mono">${euro.format(totals.expectedReceivables)}</span></div>
    </section>
    <h2>Financieel overzicht</h2>
    <table><thead><tr><th>Post</th><th>Bedrag</th><th>Context</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Bewijsstukken</h2>
    <table><thead><tr><th>Type</th><th>Relatie</th><th>Factuur</th><th>Bedrag</th><th>Betaald</th><th>PDF / opslag</th></tr></thead><tbody>${evidenceRows}</tbody></table>
  </main>
</body>
</html>`;
    downloadFile(`boekhouderpakket-${clientProfile.companyName}-${today}.html`, html, "text/html;charset=utf-8");
  }

  function updateInvoiceDoc(id: string, patch: Partial<InvoiceDocument>) {
    setInvoiceDocs((current) => current.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)));
  }

  function removeInvoiceDoc(id: string) {
    setInvoiceDocs((current) => current.filter((doc) => doc.id !== id));
    if (selectedDocId === id) {
      setSelectedDocId(invoiceDocs.find((doc) => doc.id !== id)?.id ?? "");
    }
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
      { name: newSalary.name.trim(), salary: total, holidayPay: null, total, status: "Actief" },
    ]);
    setEmployee(newSalary.name.trim());
    setNewSalary({ name: "", total: "" });
  }

  function updateEmployeeName(index: number, name: string) {
    const previousName = salaries[index]?.name;
    setSalaries((current) => updateIndex(current, index, { name }));
    if (!previousName) return;
    setPayrollDocs((current) =>
      current.map((doc) => (doc.employee === previousName ? { ...doc, employee: name } : doc)),
    );
    if (employee === previousName) setEmployee(name);
  }

  function setEmployeeStatus(index: number, status: Salary["status"]) {
    const changedEmployee = salaries[index];
    if (!changedEmployee) return;
    setSalaries((current) => updateIndex(current, index, { status }));
    if (status === "Uit dienst" && employee === changedEmployee.name) {
      const nextActive = salaries.find((salary, currentIndex) => currentIndex !== index && isActiveEmployee(salary));
      setEmployee(nextActive?.name ?? "");
    }
  }

  function removeEmployee(index: number) {
    const removedEmployee = salaries[index];
    if (!removedEmployee) return;
    const remaining = salaries.filter((_, currentIndex) => currentIndex !== index);
    setSalaries(remaining);
    setPayrollDocs((current) => current.filter((doc) => doc.employee !== removedEmployee.name));
    if (employee === removedEmployee.name) {
      setEmployee(remaining.find(isActiveEmployee)?.name ?? "");
    }
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
    setInvoiceDocs(sampleInvoiceDocuments);
    setSelectedDocId(sampleInvoiceDocuments[0]?.id ?? "");
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
    invoiceDocs,
    reminders,
    automationSettings,
    clientProfile,
    periodView,
    dateRange,
    cashCoverage,
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

  const mailtoHref = `mailto:${encodeURIComponent(emailDraft.to)}?subject=${encodeURIComponent(
    emailDraft.subject,
  )}&body=${encodeURIComponent(emailDraft.body)}`;

  const tabItems = [
    { id: "onboarding" as const, icon: PlugZap, label: "Setup", description: "Connecties en klantprofiel" },
    { id: "overzicht" as const, icon: Gauge, label: "Overzicht", description: "Cash, kosten en deadlines" },
    { id: "loonstroken" as const, icon: ReceiptText, label: "Loonstroken", description: "Profielen en maandruns" },
    { id: "instanties" as const, icon: ClipboardList, label: "Instanties", description: "Export en bewijspakket" },
    { id: "facturen" as const, icon: WalletCards, label: "Facturen", description: "Te betalen en te ontvangen" },
    { id: "automation" as const, icon: Bot, label: "Automation", description: "Inbox, Slack en reminders" },
    { id: "email" as const, icon: Mail, label: "E-mail", description: "Templates en GitHub flow" },
  ];
  const activeTabItem = tabItems.find((item) => item.id === tab) ?? tabItems[0];
  const ActiveTabIcon = activeTabItem.icon;

  return (
    <main className="ev-canvas min-h-[100dvh] text-[#0B0B0C]" data-theme={theme}>
      <div className="ev-shell">
        <aside className="ev-sidebar">
          <div className="ev-sidebar-brand">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#E8D9B8]/18 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(245,242,237,0.08)]">
              {clientProfile.logoUrl ? (
                <img src={clientProfile.logoUrl} alt={clientProfile.companyName} className="max-h-9 max-w-9 object-contain" />
              ) : (
                <Building2 className="text-[#E8D9B8]" size={22} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F5F2ED]">EcomVault Ops</p>
              <p className="truncate text-xs text-[#F5F2ED]/48">{clientProfile.companyName}</p>
            </div>
          </div>

          <nav className="ev-sidebar-nav" aria-label="Dashboard navigatie">
            {tabItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={cn("ev-nav-item", tab === item.id && "ev-nav-item-active")}
                  aria-pressed={tab === item.id}
                >
                  <span className="ev-nav-icon">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className="block truncate text-xs opacity-55">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="ev-sidebar-panel">
            <div>
              <p className="text-sm font-semibold text-[#F5F2ED]">{systemScore}% governance</p>
              <p className="mt-1 text-xs leading-5 text-[#F5F2ED]/50">
                {proofCoverage}% bewijsdekking · {reminders.length} acties
              </p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#2D5BFF]" style={{ width: `${Math.max(8, Math.min(systemScore, 100))}%` }} />
            </div>
          </div>

          <div className="ev-sidebar-footer">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <span className="text-xs font-medium text-[#F5F2ED]/58">{theme === "dark" ? "Dark mode" : "Light mode"}</span>
              <SkyToggle
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                label={theme === "dark" ? "Schakel naar light theme" : "Schakel naar dark theme"}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <Button variant="secondary" className="justify-center whitespace-nowrap" onClick={() => exportCsv("loonstroken", payrollRows)}>
                <FileSpreadsheet size={18} />
                CSV
              </Button>
              <Button variant="accent" className="justify-center whitespace-nowrap" onClick={exportJson}>
                <FileArchive size={18} />
                Pakket
              </Button>
            </div>
          </div>
        </aside>

        <section className="ev-workspace">
          <div className="ev-topbar">
            <div className="flex min-w-0 items-center gap-3">
              <div className="ev-titlebar-icon">
                <ActiveTabIcon size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-500">{clientProfile.sector}</p>
                <h1 className="brand-display truncate text-2xl text-[#0B0B0C] sm:text-3xl">
                  {activeTabItem.label}
                </h1>
              </div>
            </div>

            <div className="ev-topbar-actions">
              <div className="ev-search-pill hidden md:flex">
                <Search size={16} className="text-[#2D5BFF]" />
                <span className="truncate">{dateRangeLabel(dateRange)}</span>
              </div>
              <Button variant="secondary" className="whitespace-nowrap" onClick={() => setTab("automation")}>
                <TimerReset size={18} />
                Acties
              </Button>
              <Button variant="accent" className="whitespace-nowrap" onClick={exportJson}>
                <Download size={18} />
                Export
              </Button>
            </div>
          </div>

          <CommandCenter
            clientName={clientProfile.companyName}
            systemScore={systemScore}
            dateLabel={dateRangeLabel(dateRange)}
            cashCoverage={cashCoverage}
            proofCoverage={proofCoverage}
            nextReminder={nextReminder}
            onOpenAutomation={() => setTab("automation")}
          />

        {tab === "onboarding" && (
          <section className="grid gap-5">
            <Card className="ev-spotlight overflow-hidden border-[#0B0B0C] bg-[#0B0B0C] text-[#F5F2ED]">
              <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
                <div>
                  <p className="text-sm font-medium text-[#E8D9B8]/82">Private client operating layer</p>
                  <h2 className="brand-display mt-3 max-w-4xl text-4xl leading-none tracking-[-0.02em] text-[#F5F2ED] sm:text-5xl lg:text-6xl">
                    Financial control voor detailbedrijven op niveau.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-[#F5F2ED]/72">
                    Koppel inbox, Slack, boekhouder en bankdata. Het systeem structureert facturen,
                    loonstroken, bewijsstukken en deadlines in één branded workspace.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <MiniStat label="Setup" value={`${onboardingProgress}%`} />
                    <MiniStat label="Bewijzen" value={`${invoiceDocs.length}`} />
                    <MiniStat label="Alerts" value={`${reminders.length}`} />
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E8D9B8]/20 bg-white/[0.06] p-5 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#F5F2ED]/60">Installatiestatus</p>
                      <p className="mt-1 text-3xl font-semibold text-white">{onboardingProgress}% klaar</p>
                    </div>
                    <ShieldCheck className="text-[#2D5BFF]" size={30} />
                  </div>
                  <div className="mt-5 grid gap-3">
                    {connectorChecklist.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="min-w-0">
                          <p className="font-medium text-white">{item.label}</p>
                          <p className="truncate text-sm text-[#F5F2ED]/55">{item.detail}</p>
                        </div>
                        <Badge tone={item.done ? "good" : "warn"}>{item.done ? "Verbonden" : "Actie"}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <section className="grid gap-4 lg:grid-cols-4">
              <InstallTile icon={Mail} title="Inbox" detail="IMAP/Gmail app password voor facturen, loonstroken en vaste lasten." status="Required" />
              <InstallTile icon={Send} title="SMTP" detail="Uitgaande klantmails en betalingsherinneringen vanuit eigen domein." status="Required" />
              <InstallTile icon={MessageSquareWarning} title="Slack" detail="Incoming webhook voor deadline alerts en bank-upload reminders." status="Required" />
              <InstallTile icon={LockKeyhole} title="Bankdata" detail="V1 via CSV/XLS upload. V2 via PSD2-provider zodra product klaar is." status="Safe V1" />
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="overflow-hidden">
                <SectionHeader title="Klantprofiel" note="White-label basis voor deze klant" />
                <div className="grid gap-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Bedrijfsnaam">
                      <Input
                        value={clientProfile.companyName}
                        onChange={(event) => setClientProfile((current) => ({ ...current, companyName: event.target.value }))}
                      />
                    </Field>
                    <Field label="Segment">
                      <Input
                        value={clientProfile.sector}
                        onChange={(event) => setClientProfile((current) => ({ ...current, sector: event.target.value }))}
                      />
                    </Field>
                    <Field label="Contactpersoon">
                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                        <Input
                          className="pl-9"
                          value={clientProfile.contactName}
                          onChange={(event) => setClientProfile((current) => ({ ...current, contactName: event.target.value }))}
                        />
                      </div>
                    </Field>
                    <Field label="Administratie e-mail">
                      <Input
                        type="email"
                        value={clientProfile.adminEmail}
                        onChange={(event) => setClientProfile((current) => ({ ...current, adminEmail: event.target.value }))}
                      />
                    </Field>
                    <Field label="Boekhouder e-mail">
                      <Input
                        type="email"
                        value={clientProfile.bookkeeperEmail}
                        onChange={(event) => setClientProfile((current) => ({ ...current, bookkeeperEmail: event.target.value }))}
                      />
                    </Field>
                    <Field label="Slack kanaal">
                      <Input
                        value={clientProfile.slackChannel}
                        onChange={(event) => {
                          const value = event.target.value;
                          setClientProfile((current) => ({ ...current, slackChannel: value }));
                          setAutomationSettings((current) => ({ ...current, slackChannel: value }));
                        }}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                    <Field label="Logo URL">
                      <Input
                        value={clientProfile.logoUrl}
                        onChange={(event) => setClientProfile((current) => ({ ...current, logoUrl: event.target.value }))}
                      />
                    </Field>
                    <Field label="Actiekleur">
                      <Input
                        type="color"
                        value={clientProfile.brandColor}
                        onChange={(event) => setClientProfile((current) => ({ ...current, brandColor: event.target.value }))}
                      />
                    </Field>
                  </div>
                  <input ref={logoInputRef} className="hidden" type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={handleLogoUpload} />
                  <Button variant="secondary" onClick={() => logoInputRef.current?.click()}>
                    <Palette size={18} />
                    Logo uploaden
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <SectionHeader title="Veilige bankflow" note="Zonder banklogins in het systeem" />
                <div className="grid gap-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Preview label="Uploadritme" value={clientProfile.bankUploadCadence} />
                    <Preview label="Laatste upload" value={clientProfile.lastBankUpload || "Nog geen bankbestand"} />
                    <Preview label="Cashruimte" value={euro.format(cashCoverage)} />
                  </div>
                  <div className="rounded-xl border border-dashed border-[#2D5BFF]/40 bg-[#2D5BFF]/5 p-5">
                    <div className="flex items-start gap-3">
                      <Landmark className="mt-1 text-[#2D5BFF]" />
                      <div>
                        <h3 className="flex items-center gap-2 font-semibold text-[#0B0B0C]">
                          <CreditCard size={18} />
                          Slack message voor klant
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-neutral-600">
                          Upload je bank CSV/XLS van de afgelopen 30 dagen. Het systeem rekent beschikbaar geld,
                          cashflow en afwijkende kosten uit zonder bankcredentials te bewaren.
                        </p>
                      </div>
                    </div>
                  </div>
                  <input ref={bankInputRef} className="hidden" type="file" accept=".csv,.xls,.xlsx" onChange={handleBankUpload} />
                  <Button variant="accent" onClick={() => bankInputRef.current?.click()}>
                    <Upload size={18} />
                    Bankbestand uploaden
                  </Button>
                </div>
              </Card>
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="overflow-hidden">
                <SectionHeader title="Branded factuur maken" note="Voor detailers, carwash en servicebedrijven" />
                <div className="grid gap-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Klant">
                      <Input value={invoiceDraft.client} onChange={(event) => setInvoiceDraft((current) => ({ ...current, client: event.target.value }))} />
                    </Field>
                    <Field label="Klant e-mail">
                      <Input type="email" value={invoiceDraft.email} onChange={(event) => setInvoiceDraft((current) => ({ ...current, email: event.target.value }))} />
                    </Field>
                    <Field label="Factuurnummer">
                      <Input value={invoiceDraft.invoiceNumber} onChange={(event) => setInvoiceDraft((current) => ({ ...current, invoiceNumber: event.target.value }))} />
                    </Field>
                    <Field label="Vervaldatum">
                      <Input value={invoiceDraft.dueDate} onChange={(event) => setInvoiceDraft((current) => ({ ...current, dueDate: event.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Omschrijving">
                    <Input value={invoiceDraft.description} onChange={(event) => setInvoiceDraft((current) => ({ ...current, description: event.target.value }))} />
                  </Field>
                  <Field label="Bedrag">
                    <Input type="number" step="0.01" value={invoiceDraft.amount} onChange={(event) => setInvoiceDraft((current) => ({ ...current, amount: event.target.value }))} />
                  </Field>
                  <Button variant="accent" onClick={exportBrandedInvoice}>
                    <FilePlus2 size={18} />
                    Branded factuur exporteren
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <SectionHeader title="Boekhouderpakket" note="Kosten, cashflow, bewijs en cijfers" />
                <div className="grid gap-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Preview label="Open kosten" value={euro.format(totals.openPayables + totals.fixedOpen + totals.openTaxes)} />
                    <Preview label="Te ontvangen" value={euro.format(totals.expectedReceivables)} />
                    <Preview label="Activa indicatie" value={euro.format(totals.cash + totals.expectedReceivables)} />
                    <Preview label="Passiva indicatie" value={euro.format(totals.openPayables + totals.openTaxes + totals.fixedOpen)} />
                  </div>
                  <Button variant="secondary" onClick={exportAccountantReport}>
                    <Download size={18} />
                    Boekhouder HTML export
                  </Button>
                </div>
              </Card>
            </section>
          </section>
        )}

        {tab === "overzicht" && (
          <>
            <Card className="overflow-hidden">
              <SectionHeader title="Periode kiezen" note={dateRangeLabel(dateRange)} />
              <div className="grid gap-4 p-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dateRangePresets.map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => {
                        const nextRange = buildDateRange(preset.key);
                        setDateRange(nextRange);
                        if (preset.key === "thisQuarter") setPeriodView("kwartaal");
                        if (preset.key === "year" || preset.key === "last365") setPeriodView("jaar");
                        if (["today", "yesterday", "last7", "thisMonth", "last30", "last90"].includes(preset.key)) {
                          setPeriodView("maand");
                        }
                      }}
                      className={cn(
                        "h-9 shrink-0 rounded-md px-3 text-sm font-semibold transition",
                        dateRange.preset === preset.key
                          ? "bg-[#0B0B0C] text-[#F5F2ED]"
                          : "bg-[#F5F2ED] text-[#0B0B0C] ring-1 ring-[#E8D9B8]/80 hover:bg-white",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_180px]">
                  <Field label="Startdatum">
                    <Input
                      type="date"
                      value={dateRange.start}
                      onChange={(event) =>
                        setDateRange((current) => ({ ...current, preset: "custom", start: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Einddatum">
                    <Input
                      type="date"
                      value={dateRange.end}
                      onChange={(event) =>
                        setDateRange((current) => ({ ...current, preset: "custom", end: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Weergave">
                    <Select value={periodView} onChange={(event) => setPeriodView(event.target.value as PeriodView)}>
                      <option value="maand">Maand</option>
                      <option value="kwartaal">Kwartaal</option>
                      <option value="jaar">Jaar</option>
                    </Select>
                  </Field>
                </div>
              </div>
            </Card>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {financialMetrics.map((metric) => (
                <Metric
                  key={metric.key}
                  title={metric.title}
                  value={euro.format(metric.value)}
                  detail={metric.detail}
                  icon={metric.icon}
                  danger={metric.danger}
                  active={selectedMetric === metric.key}
                  onClick={() => setSelectedMetric(metric.key)}
                />
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="overflow-hidden">
                <SectionHeader title={`${selectedFinancialMetric.title} analyse`} note={`${periodLabel(periodView)}weergave`} />
                <div className="grid gap-5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                        <BarChart3 size={16} />
                        Geselecteerde post
                      </p>
                      <p className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-[#0B0B0C]">{euro.format(selectedFinancialMetric.value)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#0B0B0C] p-1">
                      {(["maand", "kwartaal", "jaar"] as PeriodView[]).map((view) => (
                        <button
                          key={view}
                          onClick={() => setPeriodView(view)}
                          className={cn(
                            "h-9 rounded-md px-3 text-sm font-semibold transition",
                            periodView === view ? "bg-[#2D5BFF] text-white" : "text-[#F5F2ED]/70 hover:bg-white/10",
                          )}
                        >
                          {periodLabel(view)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {chartRows.map((row) => (
                      <div key={row.label} className="grid gap-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-neutral-600">{row.label}</span>
                          <span className="font-mono font-semibold text-[#0B0B0C]">{euro.format(row.value)}</span>
                        </div>
                        <div className="h-4 overflow-hidden rounded-full bg-[#EAE6DE]">
                          <div
                            className="h-full rounded-full bg-[#2D5BFF]"
                            style={{ width: `${clampPercent(row.value, chartMax)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden bg-[#0B0B0C] text-[#F5F2ED]">
                <SectionHeader title="Management snapshot" note="Wat moet aandacht krijgen" dark />
                <div className="grid gap-3 p-5">
                  <Preview dark label="Cash na verplichtingen" value={euro.format(cashCoverage)} />
                  <Preview dark label="Deadline alerts" value={`${reminders.length} open acties`} />
                  <Preview dark label="Documentdekking" value={`${linkedDocumentCount}/${invoiceDocs.length} gekoppeld`} />
                  <Preview dark label="Payroll controle" value={`${payrollCompletion}% compleet`} />
                </div>
              </Card>
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
                <SectionHeader title="Medewerkers en salarisrun" note={`${payrollCompletion}% loonstroken gekoppeld`} />
                <div className="table-scroll overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-neutral-950 text-white">
                      <tr>
                        <Th>Medewerker</Th>
                        <Th>Salaris</Th>
                        <Th>Vakantiegeld</Th>
                        <Th>Totaal</Th>
                        <Th>Dienstverband</Th>
                        <Th>Status</Th>
                        <Th>Actie</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {salaries.map((salary, salaryIndex) => {
                        const linked = payrollDocs.some((doc) => doc.employee === salary.name);
                        const active = isActiveEmployee(salary);
                        return (
                          <tr key={`${salary.name}-${salaryIndex}`} className={active ? "bg-white" : "bg-neutral-50"}>
                            <Td>
                              <Input
                                value={salary.name}
                                onChange={(event) => updateEmployeeName(salaryIndex, event.target.value)}
                                aria-label={`Naam medewerker ${salaryIndex + 1}`}
                              />
                            </Td>
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
                              <Select
                                value={salary.status ?? "Actief"}
                                onChange={(event) =>
                                  setEmployeeStatus(salaryIndex, event.target.value as Salary["status"])
                                }
                              >
                                <option>Actief</option>
                                <option>Uit dienst</option>
                              </Select>
                            </Td>
                            <Td>
                              <Badge tone={!active ? "neutral" : linked ? "good" : "warn"}>
                                {!active ? "Uit salarisrun" : linked ? "Loonstrook gekoppeld" : "Loonstrook ontbreekt"}
                              </Badge>
                            </Td>
                            <Td>
                              <Button variant="danger" size="sm" onClick={() => removeEmployee(salaryIndex)}>
                                <X size={16} />
                                Verwijder
                              </Button>
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
                        <Td><Badge tone="good">Actief</Badge></Td>
                        <Td><Badge tone="warn">Nieuw</Badge></Td>
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
                      <p className="text-sm font-semibold text-[#E8D9B8]">Controlelijst</p>
                      <h2 className="mt-1 text-xl font-bold">Klaarzetten voor instanties</h2>
                    </div>
                    <Badge tone="accent">{linkedActiveEmployees.length}/{activeSalaries.length}</Badge>
                  </div>
                </div>
                <div className="divide-y divide-white/10">
                  {[
                    ["Salarissen uit Excel geladen", true],
                    ["Voorbeeldloonstrook herkend", true],
                    ["Alle actieve loonstroken gekoppeld", activeSalaries.length > 0 && linkedActiveEmployees.length >= activeSalaries.length],
                    ["Open LB/BTW posten zichtbaar", true],
                    ["Exportpakket beschikbaar", true],
                  ].map(([label, done]) => (
                    <div key={label as string} className="flex items-center gap-3 p-4">
                      <CheckCircle2 className={done ? "text-[#2D5BFF]" : "text-white/25"} size={20} />
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
            <div className="grid gap-5">
              <Card className="overflow-hidden">
                <SectionHeader title="Medewerkerprofielen" note={`${activeSalaries.length} actief`} />
                <div className="grid divide-y divide-[#E8D9B8]/60">
                  {salaries.map((salary) => {
                    const docs = payrollDocs.filter((doc) => doc.employee === salary.name);
                    const approved = docs.filter((doc) => doc.status === "Goedgekeurd").length;
                    return (
                      <button
                        key={salary.name}
                        onClick={() => {
                          setSelectedPayrollEmployee(salary.name);
                          setEmployee(salary.name);
                        }}
                        className={cn(
                          "grid gap-2 p-4 text-left transition hover:bg-[#2D5BFF]/5",
                          selectedPayrollProfile?.name === salary.name && "bg-[#2D5BFF]/10",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#0B0B0C]">{salary.name}</p>
                            <p className="text-sm text-neutral-600">{euro.format(salary.total)} · {salary.status ?? "Actief"}</p>
                          </div>
                          <Badge tone={approved === docs.length && docs.length ? "good" : docs.length ? "warn" : "neutral"}>
                            {approved}/{docs.length}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="overflow-hidden">
                <SectionHeader title="Maanden" note={selectedPayrollMonth} />
                <div className="flex flex-wrap gap-2 p-4">
                  {["Alle maanden", ...payrollMonths].map((month) => (
                    <button
                      key={month}
                      onClick={() => setSelectedPayrollMonth(month)}
                      className={cn(
                        "h-9 rounded-md px-3 text-sm font-semibold transition",
                        selectedPayrollMonth === month
                          ? "bg-[#0B0B0C] text-[#F5F2ED]"
                          : "bg-[#F5F2ED] text-[#0B0B0C] ring-1 ring-[#E8D9B8]/80 hover:bg-white",
                      )}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#0B0B0C]">Loonstrook upload</h2>
                    <p className="mt-1 text-sm text-neutral-600">Koppel PDF-bestanden per profiel en maand.</p>
                  </div>
                  <Upload className="text-neutral-400" />
                </div>

                <div className="mt-5 grid gap-4">
                  <Field label="Medewerker">
                    <Select value={employee || selectedPayrollProfile?.name || activeSalaries[0]?.name || ""} onChange={(event) => {
                      setEmployee(event.target.value);
                      setSelectedPayrollEmployee(event.target.value);
                    }}>
                      {activeSalaries.map((salary) => (
                        <option key={salary.name}>{salary.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Maand / periode">
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
                    className="rounded-xl border-2 border-dashed border-[#E8D9B8] bg-[#F5F2ED] p-8 text-center transition hover:border-[#2D5BFF] hover:bg-white"
                  >
                    <FolderUp className="mx-auto mb-3 text-neutral-500" />
                    <span className="block font-semibold">Upload loonstrook</span>
                    <span className="mt-1 block text-sm text-neutral-500">PDF of afbeelding, meerdere tegelijk mogelijk</span>
                  </button>
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <SectionHeader
                title={selectedPayrollProfile ? `Loonstroken · ${selectedPayrollProfile.name}` : "Loonstroken"}
                note={`${filteredPayrollProfileDocs.length} documenten in selectie`}
              />
              <div className="grid gap-4 p-5 lg:grid-cols-4">
                <Preview label="Medewerker" value={selectedPayrollProfile?.name ?? "-"} />
                <Preview label="Maand" value={selectedPayrollMonth} />
                <Preview label="Netto totaal" value={euro.format(sum(filteredPayrollProfileDocs.map((doc) => doc.net)))} />
                <Preview label="Goedkeuring" value={`${filteredPayrollProfileDocs.filter((doc) => doc.status === "Goedgekeurd").length}/${filteredPayrollProfileDocs.length}`} />
              </div>
              <div className="grid divide-y divide-[#E8D9B8]/60">
                {filteredPayrollProfileDocs.map((doc) => (
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
                {!filteredPayrollProfileDocs.length && (
                  <div className="p-6 text-sm text-neutral-600">Geen loonstroken voor dit profiel en deze maand.</div>
                )}
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
                <Preview label="Documenten uit inbox" value={`${invoiceDocs.length} PDF/data items`} />
                <Preview label="Automation alerts" value={`${reminders.length} opvolgpunten`} />
                <Preview label="Bron Excel" value="B&T _ AuraWash Overzicht Mei 2026.xlsx" wide />
                <Preview label="Voorbeeld PDF" value="115 Murabe-A.--P07.pdf" wide />
              </div>
            </Card>
          </section>
        )}

        {tab === "automation" && (
          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="grid gap-5">
              <Card className="overflow-hidden">
                <SectionHeader title="Inbox automation" note="Gmail, PDF's, Slack en klantmail" />
                <div className="grid gap-4 p-5">
                  <Field label="Gmail account">
                    <Input
                      value={automationSettings.gmailAccount}
                      onChange={(event) =>
                        setAutomationSettings((current) => ({ ...current, gmailAccount: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Zoekregel inbox">
                    <Input
                      value={automationSettings.gmailQuery}
                      onChange={(event) =>
                        setAutomationSettings((current) => ({ ...current, gmailQuery: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Slack kanaal">
                    <Input
                      value={automationSettings.slackChannel}
                      onChange={(event) =>
                        setAutomationSettings((current) => ({ ...current, slackChannel: event.target.value }))
                      }
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Te betalen melding">
                      <Input
                        type="number"
                        min="1"
                        value={automationSettings.payableReminderDays}
                        onChange={(event) =>
                          setAutomationSettings((current) => ({
                            ...current,
                            payableReminderDays: Number(event.target.value),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Te ontvangen melding">
                      <Input
                        type="number"
                        min="1"
                        value={automationSettings.receivableReminderDays}
                        onChange={(event) =>
                          setAutomationSettings((current) => ({
                            ...current,
                            receivableReminderDays: Number(event.target.value),
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <label className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <span className="text-sm font-semibold text-neutral-700">Automatisch klantmail sturen bij te ontvangen facturen</span>
                    <input
                      type="checkbox"
                      checked={automationSettings.autoCustomerEmail}
                      onChange={(event) =>
                        setAutomationSettings((current) => ({ ...current, autoCustomerEmail: event.target.checked }))
                      }
                    />
                  </label>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <SectionHeader title="Document toevoegen" note="Factuur, vaste last of loonstrook" />
                <div className="grid gap-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Type">
                      <Select
                        value={newDocument.type}
                        onChange={(event) =>
                          setNewDocument((current) => ({ ...current, type: event.target.value as DocumentType }))
                        }
                      >
                        <option value="te-betalen">Te betalen factuur</option>
                        <option value="te-ontvangen">Te ontvangen factuur</option>
                        <option value="vaste-last">Vaste last</option>
                        <option value="loonstrook">Loonstrook</option>
                      </Select>
                    </Field>
                    <Field label="Relatie">
                      <Input
                        value={newDocument.relation}
                        onChange={(event) =>
                          setNewDocument((current) => ({ ...current, relation: event.target.value }))
                        }
                        placeholder="Klant, leverancier of medewerker"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Factuur/kenmerk">
                      <Input
                        value={newDocument.invoiceNumber}
                        onChange={(event) =>
                          setNewDocument((current) => ({ ...current, invoiceNumber: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Bedrag">
                      <Input
                        type="number"
                        step="0.01"
                        value={newDocument.amount}
                        onChange={(event) =>
                          setNewDocument((current) => ({ ...current, amount: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Vervaldatum">
                      <Input
                        value={newDocument.dueDate}
                        onChange={(event) =>
                          setNewDocument((current) => ({ ...current, dueDate: event.target.value }))
                        }
                        placeholder="YYYY-MM-DD"
                      />
                    </Field>
                  </div>
                  <Field label="Klant e-mail">
                    <Input
                      type="email"
                      value={newDocument.customerEmail}
                      onChange={(event) =>
                        setNewDocument((current) => ({ ...current, customerEmail: event.target.value }))
                      }
                      placeholder="alleen nodig voor te ontvangen facturen"
                    />
                  </Field>
                  <input
                    ref={invoiceFileInputRef}
                    className="hidden"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    multiple
                    onChange={handleInvoiceFiles}
                  />
                  <Button variant="accent" onClick={() => invoiceFileInputRef.current?.click()}>
                    <Upload size={18} />
                    PDF/document uploaden
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <SectionHeader title="Automatische meldingen" note={`${reminders.length} opvolgpunten`} />
                <div className="grid divide-y divide-neutral-100">
                  {reminders.map((reminder) => (
                    <article key={reminder.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_160px] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <MessageSquareWarning size={18} className="text-neutral-500" />
                          <h3 className="font-semibold text-neutral-950">{reminder.relation}</h3>
                          <Badge tone={reminder.urgency === "overdue" ? "danger" : reminder.urgency === "missing-date" ? "warn" : "accent"}>
                            {reminder.urgency === "overdue"
                              ? "Te laat"
                              : reminder.urgency === "missing-date"
                                ? "Datum mist"
                                : `${reminder.daysLeft} dagen`}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-neutral-600">
                          {reminder.kind} · {reminder.invoice} · {euro.format(reminder.amount)} · {reminder.action}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setEmailDraft({
                            to: receivables.find((item) => item.invoice === reminder.invoice)?.customerEmail ?? "",
                            subject: `Herinnering factuur ${reminder.invoice}`,
                            body: `Hi,\n\nWe zien dat factuur ${reminder.invoice} van ${euro.format(reminder.amount)} nog open staat. Wil je deze uiterlijk ${reminder.dueDate} overboeken?\n\nGroet,\nAuraWash`,
                          })
                        }
                      >
                        <Mail size={16} />
                        Mail
                      </Button>
                    </article>
                  ))}
                  {!reminders.length && (
                    <div className="p-5 text-sm text-neutral-600">Geen open reminders op basis van de huidige datums.</div>
                  )}
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <SectionHeader title="Documentendossier" note={`${invoiceDocs.length} documenten · ${linkedDocumentCount} gekoppeld`} />
              <div className="grid min-h-[720px] lg:grid-cols-[360px_1fr]">
                <div className="border-b border-neutral-200 lg:border-b-0 lg:border-r">
                  <div className="grid max-h-[720px] overflow-y-auto">
                    {invoiceDocs.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={cn(
                          "grid gap-2 border-b border-neutral-100 p-4 text-left transition hover:bg-neutral-50",
                          selectedDoc?.id === doc.id && "bg-[#2D5BFF]/10",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-neutral-950">{doc.relation}</span>
                          <Badge tone={doc.paid === "NEE" ? "danger" : "good"}>{doc.paid}</Badge>
                        </div>
                        <span className="truncate text-sm text-neutral-600">{doc.invoiceNumber} · {doc.fileName}</span>
                        <span className="text-xs font-semibold uppercase text-neutral-500">{doc.type} · {doc.source}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDoc && (
                  <div className="grid gap-5 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText size={20} className="text-neutral-500" />
                          <h2 className="truncate text-xl font-bold text-neutral-950">{selectedDoc.fileName}</h2>
                        </div>
                        <p className="mt-1 text-sm text-neutral-600">{selectedDoc.subject}</p>
                      </div>
                      <div className="flex gap-2">
                        {selectedDoc.previewUrl && (
                          <a
                            href={selectedDoc.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-neutral-950 ring-1 ring-neutral-200 transition hover:bg-neutral-100"
                          >
                            <Eye size={16} />
                            PDF
                          </a>
                        )}
                        <Button variant="danger" size="sm" onClick={() => removeInvoiceDoc(selectedDoc.id)}>
                          <X size={16} />
                          Verwijder
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Relatie">
                        <Input
                          value={selectedDoc.relation}
                          onChange={(event) => updateInvoiceDoc(selectedDoc.id, { relation: event.target.value })}
                        />
                      </Field>
                      <Field label="Factuur/kenmerk">
                        <Input
                          value={selectedDoc.invoiceNumber}
                          onChange={(event) => updateInvoiceDoc(selectedDoc.id, { invoiceNumber: event.target.value })}
                        />
                      </Field>
                      <Field label="Bedrag">
                        <Input
                          type="number"
                          step="0.01"
                          value={selectedDoc.amount}
                          onChange={(event) => updateInvoiceDoc(selectedDoc.id, { amount: Number(event.target.value) })}
                        />
                      </Field>
                      <Field label="Vervaldatum">
                        <Input
                          value={selectedDoc.dueDate}
                          onChange={(event) => updateInvoiceDoc(selectedDoc.id, { dueDate: event.target.value })}
                        />
                      </Field>
                      <Field label="Status">
                        <Select
                          value={selectedDoc.status}
                          onChange={(event) =>
                            updateInvoiceDoc(selectedDoc.id, { status: event.target.value as InvoiceDocument["status"] })
                          }
                        >
                          <option>Nieuw</option>
                          <option>Controle</option>
                          <option>Goedgekeurd</option>
                          <option>Afgekeurd</option>
                          <option>Betaald</option>
                          <option>Niet betaald</option>
                        </Select>
                      </Field>
                      <Field label="Betaald">
                        <PaidSelect
                          value={selectedDoc.paid}
                          onChange={(paid) =>
                            updateInvoiceDoc(selectedDoc.id, {
                              paid,
                              status: paid === "NEE" ? "Niet betaald" : "Betaald",
                            })
                          }
                        />
                      </Field>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Preview label="Afzender" value={`${selectedDoc.sender}${selectedDoc.senderEmail ? ` · ${selectedDoc.senderEmail}` : ""}`} />
                      <Preview label="Ontvangen" value={selectedDoc.receivedAt} />
                      <Preview label="Opslag" value={selectedDoc.storagePath || "Upload in browser-sessie"} wide />
                      <Preview label="Extractie" value={selectedDoc.extractedText || "Nog geen tekstextractie beschikbaar"} wide />
                    </div>

                    {selectedDoc.previewUrl ? (
                      <iframe
                        title={selectedDoc.fileName}
                        src={selectedDoc.previewUrl}
                        className="min-h-[360px] w-full rounded-md border border-neutral-200 bg-neutral-50"
                      />
                    ) : (
                      <div className="grid min-h-[260px] place-items-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
                        PDF-preview verschijnt hier bij browser-upload. Automatisch gefetchte PDF's staan lokaal onder `automation/documents`.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </section>
        )}

        {tab === "email" && (
          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 text-neutral-500" />
                <div>
                  <h2 className="text-xl font-bold">E-mail automation</h2>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">
                    Maak hier de e-mail klaar. Versturen kan via je mailprogramma of via GitHub Actions met SMTP-secrets.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <Field label="Ontvanger">
                  <Input
                    type="email"
                    value={emailDraft.to}
                    onChange={(event) =>
                      setEmailDraft((current) => ({ ...current, to: event.target.value }))
                    }
                    placeholder="zijn@email.nl"
                  />
                </Field>
                <Field label="Onderwerp">
                  <Input
                    value={emailDraft.subject}
                    onChange={(event) =>
                      setEmailDraft((current) => ({ ...current, subject: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Bericht">
                  <textarea
                    value={emailDraft.body}
                    onChange={(event) =>
                      setEmailDraft((current) => ({ ...current, body: event.target.value }))
                    }
                    className="min-h-48 w-full rounded-md border border-[#E8D9B8]/80 bg-white px-3 py-3 text-sm text-[#0B0B0C] outline-none transition placeholder:text-neutral-500 focus:border-[#2D5BFF] focus:ring-2 focus:ring-[#2D5BFF]/20"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2D5BFF] px-4 text-sm font-semibold text-white transition hover:bg-[#1F47E0]"
                    href={mailtoHref}
                  >
                    <Send size={18} />
                    Open e-mail
                  </a>
                  <a
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-neutral-950 ring-1 ring-neutral-200 transition hover:bg-neutral-100"
                    href={githubActionsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileArchive size={18} />
                    GitHub workflow
                  </a>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <SectionHeader title="GitHub setup" note="Eenmalig secrets toevoegen" />
              <div className="grid gap-3 p-4">
                <Preview label="Workflow" value=".github/workflows/send-email.yml" />
                <Preview label="Script" value="scripts/send-email.mjs" />
                <Preview label="Nodig in GitHub Secrets" value="SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM" wide />
                <Preview label="Runnen" value="Actions > Send automation email > Run workflow > e-mailadres invullen" wide />
                <Preview label="Veiligheid" value="Geen SMTP wachtwoorden in code. Alleen GitHub Secrets gebruiken." wide />
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
                <table className="w-full min-w-[1060px] text-left text-sm">
                  <thead className="bg-neutral-950 text-white">
                    <tr>
                      <Th>Bedrijf</Th>
                      <Th>Factuur</Th>
                      <Th>Bedrag</Th>
                      <Th>Deadline</Th>
                      <Th>Prioriteit</Th>
                      <Th>Status</Th>
                      <Th>Betaald H</Th>
                      <Th>Data</Th>
                      <Th>Opmerking</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredPayables.map(({ item, index }) => {
                      const matchingDoc = invoiceDocs.find((doc) => doc.invoiceNumber === item.invoice || doc.linkedInvoice === item.invoice);
                      return (
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
                          <Td>
                            {matchingDoc ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedDocId(matchingDoc.id);
                                  setTab("automation");
                                }}
                              >
                                <Eye size={16} />
                                Bekijk
                              </Button>
                            ) : (
                              <Badge tone="warn">Geen PDF</Badge>
                            )}
                          </Td>
                          <Td className="max-w-[260px] truncate">{item.note || "-"}</Td>
                        </tr>
                      );
                    })}
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
                      <Td><Badge tone="warn">Upload</Badge></Td>
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
                      <Th>Data</Th>
                      <Th>Actie</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredReceivables.map(({ item, index }) => {
                      const matchingDoc = invoiceDocs.find((doc) => doc.invoiceNumber === item.invoice || doc.linkedInvoice === item.invoice);
                      return (
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
                          <Td>
                            {matchingDoc ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedDocId(matchingDoc.id);
                                  setTab("automation");
                                }}
                              >
                                <Eye size={16} />
                                Bekijk
                              </Button>
                            ) : (
                              <Badge tone="warn">Geen PDF</Badge>
                            )}
                          </Td>
                          <Td className="max-w-[260px] truncate">{item.action || "-"}</Td>
                        </tr>
                      );
                    })}
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
                      <Td><Badge tone="warn">Upload</Badge></Td>
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
        </section>
      </div>
    </main>
  );
}

function CommandCenter({
  clientName,
  systemScore,
  dateLabel,
  cashCoverage,
  proofCoverage,
  nextReminder,
  onOpenAutomation,
}: {
  clientName: string;
  systemScore: number;
  dateLabel: string;
  cashCoverage: number;
  proofCoverage: number;
  nextReminder?: ReminderItem;
  onOpenAutomation: () => void;
}) {
  return (
    <section className="ev-command-grid">
      <div className="ev-command-primary rounded-xl bg-[#0B0B0C] p-4 text-[#F5F2ED]">
        <div className="relative">
          <div className="pr-8">
            <p className="text-sm font-medium text-[#E8D9B8]/82">Operationele controle</p>
            <p className="mt-2 whitespace-nowrap text-[23px] font-semibold leading-tight tracking-[-0.02em]">{systemScore}% op orde</p>
          </div>
          <Activity className="absolute right-0 top-8 text-[#2D5BFF]" size={24} />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#2D5BFF]" style={{ width: `${Math.max(8, Math.min(systemScore, 100))}%` }} />
        </div>
      </div>

      <CommandPill icon={Building2} label="Workspace" value={clientName} />
      <CommandPill icon={CalendarClock} label="Periode" value={dateLabel} />
      <CommandPill icon={Banknote} label="Cashruimte" value={euro.format(cashCoverage)} danger={cashCoverage < 0} />
      <CommandPill icon={FileCheck2} label="Bewijsdekking" value={`${proofCoverage}%`} />

      <button
        type="button"
        onClick={onOpenAutomation}
        className="ev-command-action"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
          <TimerReset size={15} />
          Eerstvolgende actie
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-semibold text-[#0B0B0C]">
          {nextReminder
            ? `${nextReminder.relation} · ${nextReminder.invoice} · ${nextReminder.action}`
            : "Geen acute reminders binnen deze selectie"}
        </p>
      </button>
    </section>
  );
}

function CommandPill({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className={cn("ev-command-card", danger && "ev-command-card-danger")}>
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
        <Icon size={15} />
        {label}
      </div>
      <p className={cn("mt-2 truncate text-sm font-semibold", danger ? "text-red-700" : "text-[#0B0B0C]")}>{value}</p>
    </div>
  );
}

function InstallTile({
  icon: Icon,
  title,
  detail,
  status,
}: {
  icon: typeof Mail;
  title: string;
  detail: string;
  status: string;
}) {
  return (
    <Card className="group overflow-hidden bg-white/90 p-5 transition hover:-translate-y-0.5 hover:border-[#2D5BFF]/35">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl bg-[#2D5BFF]/10 p-2 text-[#2D5BFF]">
          <Icon size={21} />
        </div>
        <Badge tone="accent">{status}</Badge>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-[#0B0B0C]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{detail}</p>
    </Card>
  );
}

function Metric({
  title,
  value,
  detail,
  icon: Icon,
  danger = false,
  active = false,
  onClick,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Banknote;
  danger?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm font-semibold", active ? "text-[#E8D9B8]" : "text-neutral-500")}>{title}</p>
          <p className={cn("mt-2 text-2xl font-bold", active ? "text-white" : "text-neutral-950")}>{value}</p>
          <p className={cn("mt-1 text-sm", active ? "text-[#F5F2ED]/65" : "text-neutral-600")}>{detail}</p>
        </div>
        <div className={cn("rounded-md p-2", active ? "bg-[#2D5BFF] text-white" : danger ? "bg-red-100 text-red-700" : "bg-[#2D5BFF]/10 text-[#2D5BFF]")}>
          <Icon size={20} />
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5",
          active
            ? "border-[#0B0B0C] bg-[#0B0B0C]"
            : danger
              ? "border-red-200 bg-red-50"
              : "border-[#E8D9B8]/80 bg-white",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <Card className={cn("p-4", danger && "border-red-200 bg-red-50")}>
      {content}
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
      <span className="text-sm font-medium text-neutral-600">{label}</span>
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

function SectionHeader({ title, note, dark = false }: { title: string; note: string; dark?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-2 border-b p-5 sm:flex-row sm:items-center sm:justify-between", dark ? "border-white/10" : "border-[#E8D9B8]/70")}>
      <h2 className={cn("text-xl font-semibold tracking-[-0.02em]", dark ? "text-[#F5F2ED]" : "text-[#0B0B0C]")}>{title}</h2>
      <span className={cn("text-sm font-medium", dark ? "text-[#F5F2ED]/55" : "text-neutral-500")}>{note}</span>
    </div>
  );
}

function Preview({ label, value, wide = false, dark = false }: { label: string; value: string; wide?: boolean; dark?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", dark ? "border-white/10 bg-white/[0.06]" : "border-[#E8D9B8]/70 bg-[#F5F2ED]", wide && "sm:col-span-2")}>
      <p className={cn("text-xs font-medium", dark ? "text-[#E8D9B8]" : "text-neutral-500")}>{label}</p>
      <p className={cn("mt-2 break-words text-sm font-semibold", dark ? "text-[#F5F2ED]" : "text-[#0B0B0C]")}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E8D9B8]/20 bg-white/[0.06] p-4">
      <p className="text-xs font-medium text-[#E8D9B8]">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-[13px] font-semibold text-white/76">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-neutral-700", className)}>{children}</td>;
}

export default App;
