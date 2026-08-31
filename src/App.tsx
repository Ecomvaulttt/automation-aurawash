import { ChangeEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  Banknote,
  BarChart3,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
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
  LoaderCircle,
  Mail,
  MessageSquareWarning,
  Palette,
  PlayCircle,
  PlugZap,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Upload,
  Users,
  UserRound,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { SkyToggle } from "./components/ui/sky-toggle";
import { ProductTour, ProductTourStep } from "./components/product-tour";
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
import { downloadBlob, downloadFile, ExportRow, toCsv } from "./lib/export";
import { createInvoicePdf, downloadAccountantPackage } from "./lib/accounting-export";
import { parseAuraWorkbook, parseBankFile } from "./lib/imports";
import { deleteWorkspaceDocument, syncWorkspaceInvoices, uploadBankStatement, uploadWorkspaceDocument } from "./lib/platform-files";
import { cn } from "./lib/utils";
import { PlatformAdminCenter } from "./platform/admin/PlatformAdminCenter";
import { useAuth } from "./platform/auth/AuthProvider";
import { platformConfig } from "./platform/config";
import { navigationFor } from "./platform/workspace/permissions";
import { useWorkspace } from "./platform/workspace/WorkspaceProvider";
import { getSupabaseClient } from "./platform/supabase";

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const number = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 0,
});

const today = toIsoDate(new Date());
const githubActionsUrl =
  "https://github.com/Ecomvaulttt/automation-aurawash/actions/workflows/send-email.yml";
const defaultPayrollEmployee = samplePayrollDocs[0]?.employee ?? initialSalaries[0]?.name ?? "";

type Tab = "onboarding" | "overzicht" | "loonstroken" | "instanties" | "facturen" | "automation" | "email" | "admin";
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

type AppTourStep = ProductTourStep & { tab: Tab };

const productTourSteps: AppTourStep[] = [
  {
    tab: "overzicht",
    selector: "[data-tour='command-center']",
    title: "Je dagelijkse cockpit",
    description: "Zie direct de systeemscore, cashruimte, bewijsdekking en eerstvolgende actie voor deze werkruimte.",
  },
  {
    tab: "overzicht",
    selector: "[data-tour='period-filter']",
    title: "Cijfers in elke periode",
    description: "Wissel tussen vandaag, maand, kwartaal, jaar of een eigen datumbereik. Alle overzichten rekenen direct mee.",
  },
  {
    tab: "onboarding",
    selector: "[data-tour='installation-status']",
    title: "Plug-and-play installatie",
    description: "Klik op iedere statusregel om meteen naar de ontbrekende koppeling of instelling te springen.",
  },
  {
    tab: "facturen",
    selector: "[data-tour='invoice-control']",
    title: "Facturen onder controle",
    description: "Beheer te betalen en te ontvangen facturen, inclusief betaalstatus, prioriteit, deadlines en PDF-bewijs.",
  },
  {
    tab: "loonstroken",
    selector: "[data-tour='payroll-profiles']",
    title: "Loonstroken per medewerker",
    description: "Open een medewerkersprofiel, kies de maand en keur loonstroken goed of af vanuit één dossier.",
  },
  {
    tab: "automation",
    selector: "[data-tour='automation-settings']",
    title: "Automatische opvolging",
    description: "Koppel inbox en Slack en bepaal wanneer interne meldingen en klantmails worden verstuurd.",
  },
  {
    tab: "automation",
    selector: "[data-tour='ai-helper']",
    title: "Vraag het aan EcomVault AI",
    description: "Stel direct vragen over cash, open facturen, deadlines, loonstroken en ontbrekende administratie.",
  },
];

const productTourStorageKey = "ecomvault-product-tour-v1";

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

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AiContextSnapshot = {
  companyName: string;
  currentView: Tab;
  period: string;
  financial: {
    available: number;
    salaries: number;
    openTaxes: number;
    openPayables: number;
    expectedReceivables: number;
    fixedCosts: number;
    cashCoverage: number;
  };
  counts: {
    activeEmployees: number;
    payrollDocuments: number;
    invoiceDocuments: number;
    openPayables: number;
    openReceivables: number;
  };
  reminders: Array<{
    relation: string;
    invoice: string;
    amount: number;
    dueDate: string;
    action: string;
  }>;
  openPayables: Array<Record<string, string | number>>;
  openReceivables: Array<Record<string, string | number>>;
  employees: Array<Record<string, string | number>>;
  checks: Array<{
    title: string;
    detail: string;
    value: string;
    tone: OverviewCheckTone;
  }>;
};

type OverviewCheckTone = "danger" | "warn" | "good";

type OverviewCheck = {
  id: string;
  title: string;
  detail: string;
  value: string;
  tone: OverviewCheckTone;
  icon: typeof Banknote;
  target: Tab;
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

const primaryDateRangePresets = dateRangePresets.filter((preset) =>
  ["today", "last7", "thisMonth", "thisQuarter", "year"].includes(preset.key),
);

const additionalDateRangePresets = dateRangePresets.filter((preset) =>
  ["yesterday", "last30", "last90", "halfYear", "last365", "total"].includes(preset.key),
);

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

type OperationNotice = { tone: "good" | "warn" | "danger"; message: string };

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

function useStoredState<T>(key: string, fallback: T, allowProduction = false) {
  const storageEnabled = platformConfig.mode === "demo" || allowProduction;
  const [value, setValue] = useState<T>(() => storageEnabled ? loadStored(key, fallback) : fallback);

  function setStored(next: T | ((current: T) => T)) {
    setValue((current) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      if (storageEnabled) saveStored(key, resolved);
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function localAiReply(question: string, context: AiContextSnapshot) {
  const normalized = question.toLowerCase();

  if (/cash|geld|ruimte|beschikbaar/.test(normalized)) {
    return `Er is ${euro.format(context.financial.available)} beschikbaar. Na salarissen, belastingen, open facturen en vaste lasten is de berekende cashruimte ${euro.format(context.financial.cashCoverage)}.`;
  }

  if (/factur|betalen|ontvangen|openstaand/.test(normalized)) {
    return `Er staan ${context.counts.openPayables} te betalen facturen open voor ${euro.format(context.financial.openPayables)}. Te ontvangen: ${context.counts.openReceivables} facturen voor ${euro.format(context.financial.expectedReceivables)}.`;
  }

  if (/salaris|loon|medewerker/.test(normalized)) {
    return `Het systeem bevat ${context.counts.activeEmployees} actieve medewerkers en ${context.counts.payrollDocuments} loonstroken. Het salarisbedrag in de huidige selectie is ${euro.format(context.financial.salaries)}.`;
  }

  if (/vandaag|actie|deadline|eerst|prioriteit/.test(normalized)) {
    if (!context.reminders.length) return "Er staan momenteel geen open reminders in de administratie.";
    const list = context.reminders
      .slice(0, 3)
      .map((item) => `${item.relation} (${item.invoice}): ${item.action}`)
      .join("; ");
    return `De eerstvolgende aandachtspunten zijn: ${list}.`;
  }

  if (/export|boekhouder|instantie/.test(normalized)) {
    return "Open Instanties voor het volledige gegevenspakket of gebruik Export rechtsboven. Daar staan de losse CSV-bestanden en het boekhouderpakket.";
  }

  if (/mist|ontbre|controle|risico|compleet|kwaliteit/.test(normalized)) {
    const attention = context.checks.filter((item) => item.tone !== "good");
    if (!attention.length) return "Alle automatische controles staan op groen. Er zijn nu geen ontbrekende onderdelen gevonden.";
    return `Dit vraagt aandacht: ${attention.map((item) => `${item.title} (${item.value})`).join("; ")}.`;
  }

  return "Ik kan vragen beantwoorden over beschikbaar geld, open facturen, betalingen, loonstroken, deadlines, medewerkers en exports. Voor vrije vervolgvragen activeert de beheerder de gratis Groq-koppeling.";
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
    { key: "gmail", label: "Gmail inbox", done: Boolean(settings.gmailAccount), detail: settings.gmailAccount || "Nog niet verbonden", tab: "automation" as Tab, targetId: "setup-gmail" },
    { key: "slack", label: "Slack kanaal", done: Boolean(settings.slackChannel), detail: settings.slackChannel || "Nog niet gekozen", tab: "automation" as Tab, targetId: "setup-slack" },
    { key: "bookkeeper", label: "Boekhouder", done: Boolean(profile.bookkeeperEmail), detail: profile.bookkeeperEmail || "E-mail ontbreekt", tab: "onboarding" as Tab, targetId: "setup-bookkeeper" },
    { key: "bank", label: "Bankbestand", done: Boolean(profile.lastBankUpload), detail: profile.lastBankUpload || "Upload CSV/XLS van 30 dagen", tab: "onboarding" as Tab, targetId: "setup-bank" },
    { key: "branding", label: "Klantbranding", done: Boolean(profile.companyName && profile.logoUrl), detail: profile.companyName || "Bedrijfsnaam/logo", tab: "onboarding" as Tab, targetId: "setup-branding" },
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
  const auth = useAuth();
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
  const demoMode = auth.mode === "demo";
  const [tab, setTab] = useState<Tab>("overzicht");
  const [query, setQuery] = useState("");
  const [invoiceLedgerView, setInvoiceLedgerView] = useState<"payables" | "receivables">("payables");
  const [theme, setTheme] = useStoredState<ThemeMode>("ecomvault-theme", "light", true);
  const [periodView, setPeriodView] = useStoredState<PeriodView>("ecomvault-period-view", "maand", true);
  const [selectedMetric, setSelectedMetric] = useStoredState<MetricKey>("ecomvault-selected-metric", "cash", true);
  const [dateRange, setDateRange] = useStoredState<DateRangeState>("ecomvault-date-range", buildDateRange("total"), true);
  const [clientProfile, setClientProfile] = useStoredState<ClientProfile>("ecomvault-client-profile", {
    companyName: demoMode ? "AuraWash" : activeWorkspace.organizationName,
    sector: demoMode ? "Autodetailing / carwash" : "",
    contactName: demoMode ? "Ramzi" : "",
    adminEmail: demoMode ? "administratie@aurawash.nl" : auth.user?.email ?? "",
    bookkeeperEmail: "",
    slackChannel: "#administratie",
    logoUrl: demoMode ? "https://aurawash.nl/cdn/shop/files/logo_top_site.png?v=1770326175&width=360" : "",
    brandColor: "#2D5BFF",
    bankUploadCadence: "Elke 30 dagen",
    lastBankUpload: "",
  });
  const [balances, setBalances] = useStoredState<Balance[]>("aurawash-balances", demoMode ? initialBalances : []);
  const [salaries, setSalaries] = useStoredState<Salary[]>("aurawash-salaries", demoMode ? initialSalaries : []);
  const [taxes, setTaxes] = useStoredState<TaxItem[]>("aurawash-taxes", demoMode ? initialTaxes : []);
  const [fixedCosts, setFixedCosts] = useStoredState<FixedCost[]>("aurawash-fixed-costs", demoMode ? initialFixedCosts : []);
  const [payables, setPayables] = useStoredState<Payable[]>("aurawash-payables", demoMode ? initialPayables : []);
  const [receivables, setReceivables] = useStoredState<Receivable[]>("aurawash-receivables", demoMode ? initialReceivables : []);
  const [payrollDocs, setPayrollDocs] = useStoredState<PayrollDoc[]>("aurawash-payroll-docs", demoMode ? samplePayrollDocs : []);
  const [invoiceDocs, setInvoiceDocs] = useStoredState<InvoiceDocument[]>("aurawash-invoice-documents", demoMode ? sampleInvoiceDocuments : []);
  const [automationSettings, setAutomationSettings] = useStoredState<AutomationSettings>("aurawash-automation-settings", {
    gmailAccount: "info@ecomvault.nl",
    gmailQuery: "has:attachment (factuur OR invoice OR loonstrook OR salaris)",
    slackChannel: "#administratie",
    payableReminderDays: 5,
    receivableReminderDays: 3,
    autoCustomerEmail: false,
  });
  const [employee, setEmployee] = useState(defaultPayrollEmployee);
  const [period, setPeriod] = useState("Mei 2026");
  const [selectedPayrollEmployee, setSelectedPayrollEmployee] = useStoredState("ecomvault-payroll-employee", defaultPayrollEmployee);
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useStoredState("ecomvault-payroll-month", "Alle maanden");
  const [newBalance, setNewBalance] = useState({ label: "", amount: "" });
  const [newSalary, setNewSalary] = useState({ name: "", total: "" });
  const [newPayable, setNewPayable] = useState({ company: "", invoice: "", amount: "", deadline: "" });
  const [newReceivable, setNewReceivable] = useState({ client: "", invoice: "", amount: "", dueDate: "" });
  const [newTax, setNewTax] = useState({ type: "", amount: "", deadline: "" });
  const [selectedDocId, setSelectedDocId] = useState(demoMode ? sampleInvoiceDocuments[0]?.id ?? "" : "");
  const [newDocument, setNewDocument] = useState({
    type: "te-betalen" as DocumentType,
    relation: "",
    invoiceNumber: "",
    amount: "",
    dueDate: "",
    customerEmail: "",
  });
  const [invoiceDraft, setInvoiceDraft] = useStoredState<InvoiceDraft>("ecomvault-invoice-draft", {
    client: demoMode ? "Udenhout" : "",
    email: "",
    invoiceNumber: `EV-${today.replaceAll("-", "")}`,
    description: "Detailing services",
    amount: "",
    dueDate: today,
  });
  const [emailDraft, setEmailDraft] = useStoredState("aurawash-email-draft", {
    to: "",
    subject: "AuraWash administratie update",
    body: `Hi,\n\nDe administratie van ${demoMode ? "AuraWash" : activeWorkspace.organizationName} is bijgewerkt. De actuele loonstroken, facturen en betaalstatussen staan klaar in het exportpakket.\n\nGroet,\n${demoMode ? "AuraWash" : activeWorkspace.organizationName}`,
    documentId: "",
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => {
    try {
      return window.localStorage.getItem(productTourStorageKey) === null;
    } catch {
      return true;
    }
  });
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [setupFocus, setSetupFocus] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<"ai" | "local" | null>(null);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    {
      id: "ai-welcome",
      role: "assistant",
      content: "Hoi, ik ben EcomVault AI. Vraag me iets over cash, facturen, loonstroken, deadlines of exports.",
    },
  ]);
  const [operationNotice, setOperationNotice] = useState<OperationNotice | null>(null);
  const [operationBusy, setOperationBusy] = useState(false);
  const [productionHydrated, setProductionHydrated] = useState(auth.mode === "demo");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const invoiceFileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bankInputRef = useRef<HTMLInputElement>(null);
  const workbookInputRef = useRef<HTMLInputElement>(null);
  const aiMessagesRef = useRef<HTMLDivElement>(null);
  const activeSalaries = salaries.filter(isActiveEmployee);

  useEffect(() => {
    if (auth.mode !== "production") return;
    [
      "ecomvault-client-profile",
      "aurawash-balances",
      "aurawash-salaries",
      "aurawash-taxes",
      "aurawash-fixed-costs",
      "aurawash-payables",
      "aurawash-receivables",
      "aurawash-payroll-docs",
      "aurawash-invoice-documents",
      "aurawash-automation-settings",
      "ecomvault-payroll-employee",
      "ecomvault-payroll-month",
      "ecomvault-invoice-draft",
      "aurawash-email-draft",
    ].forEach((key) => window.localStorage.removeItem(key));
  }, [auth.mode]);

  useEffect(() => {
    if (auth.mode !== "production") return;
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    setProductionHydrated(false);

    void (async () => {
      const snapshotQuery = client
        .from("workspace_snapshots")
        .select("data")
        .eq("organization_id", activeWorkspace.organizationId)
        .is("deleted_at", null);
      const scopedSnapshot = activeWorkspace.locationId
        ? snapshotQuery.eq("location_id", activeWorkspace.locationId)
        : snapshotQuery.is("location_id", null);
      const invoiceQuery = client
        .from("invoices")
        .select("id, direction, relation_name, invoice_number, amount, invoice_date, due_date, paid, status, priority, notes, document_id")
        .eq("organization_id", activeWorkspace.organizationId)
        .is("deleted_at", null);
      const documentQuery = client
        .from("documents")
        .select("id, document_type, file_name, storage_path, mime_type, source, status, received_at, metadata")
        .eq("organization_id", activeWorkspace.organizationId)
        .is("deleted_at", null);
      if (activeWorkspace.locationId) {
        invoiceQuery.eq("location_id", activeWorkspace.locationId);
        documentQuery.eq("location_id", activeWorkspace.locationId);
      }

      const [snapshotResult, invoiceResult, documentResult] = await Promise.all([
        scopedSnapshot.maybeSingle(),
        invoiceQuery,
        documentQuery,
      ]);
      if (!active) return;

      const snapshot = snapshotResult.data?.data as Record<string, unknown> | undefined;
      const storedPayables = Array.isArray(snapshot?.payables) ? snapshot.payables as Payable[] : [];
      const storedReceivables = Array.isArray(snapshot?.receivables) ? snapshot.receivables as Receivable[] : [];
      const storedDocuments = Array.isArray(snapshot?.invoiceDocs) ? snapshot.invoiceDocs as InvoiceDocument[] : [];
      const storedPayrollDocuments = Array.isArray(snapshot?.payrollDocs) ? snapshot.payrollDocs as PayrollDoc[] : [];
      setBalances(Array.isArray(snapshot?.balances) ? snapshot.balances as Balance[] : []);
      setSalaries(Array.isArray(snapshot?.salaries) ? snapshot.salaries as Salary[] : []);
      setTaxes(Array.isArray(snapshot?.taxes) ? snapshot.taxes as TaxItem[] : []);
      setFixedCosts(Array.isArray(snapshot?.fixedCosts) ? snapshot.fixedCosts as FixedCost[] : []);
      setPayrollDocs(storedPayrollDocuments);
      setClientProfile(snapshot?.clientProfile && typeof snapshot.clientProfile === "object"
        ? snapshot.clientProfile as ClientProfile
        : {
            companyName: activeWorkspace.organizationName,
            sector: "",
            contactName: "",
            adminEmail: auth.user?.email ?? "",
            bookkeeperEmail: "",
            slackChannel: "#administratie",
            logoUrl: "",
            brandColor: "#2D5BFF",
            bankUploadCadence: "Elke 30 dagen",
            lastBankUpload: "",
          });
      if (snapshot?.automationSettings && typeof snapshot.automationSettings === "object") {
        setAutomationSettings(snapshot.automationSettings as AutomationSettings);
      }

      const paidLabel = (value: string): PaidValue => value === "yes" ? "JA" : value === "installment" ? "JA (termijn)" : "NEE";
      const invoiceRows = (invoiceResult.data ?? []) as Array<Record<string, unknown>>;
      const fetchedPayables: Payable[] = invoiceRows.filter((row) => row.direction === "payable").map((row) => ({
        company: String(row.relation_name ?? "Onbekend"),
        invoice: String(row.invoice_number ?? ""),
        amount: Number(row.amount ?? 0),
        deadline: String(row.due_date ?? ""),
        priority: String(row.priority ?? "normaal"),
        status: row.status === "paid" ? "Betaald" : row.status === "approved" ? "Goedgekeurd" : "Controle",
        note: String(row.notes ?? ""),
        paid: paidLabel(String(row.paid ?? "no")),
        documentIds: row.document_id ? [String(row.document_id)] : [],
      }));
      const fetchedReceivables: Receivable[] = invoiceRows.filter((row) => row.direction === "receivable").map((row) => ({
        client: String(row.relation_name ?? "Onbekend"),
        invoice: String(row.invoice_number ?? ""),
        amount: Number(row.amount ?? 0),
        invoiceDate: String(row.invoice_date ?? ""),
        dueDate: String(row.due_date ?? ""),
        status: row.status === "paid" ? "Betaald" : row.status === "approved" ? "Goedgekeurd" : "Controle",
        action: String(row.notes ?? ""),
        paid: paidLabel(String(row.paid ?? "no")),
        documentIds: row.document_id ? [String(row.document_id)] : [],
      }));
      const mergeByInvoice = <T extends Payable | Receivable>(stored: T[], fetched: T[]) => {
        const key = (item: T) => "invoice" in item ? item.invoice.toLowerCase() : "";
        const merged = new Map(stored.map((item) => [key(item), item]));
        fetched.forEach((item) => merged.set(key(item), item));
        return Array.from(merged.values());
      };
      setPayables(mergeByInvoice(storedPayables, fetchedPayables));
      setReceivables(mergeByInvoice(storedReceivables, fetchedReceivables));

      const fetchedDocuments = await Promise.all(((documentResult.data ?? []) as Array<Record<string, unknown>>).map(async (row) => {
        const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
        const signed = await client.storage.from("documents").createSignedUrl(String(row.storage_path), 3600);
        const documentType = String(row.document_type);
        const type: DocumentType = documentType === "payroll"
          ? "loonstrook"
          : ["te-betalen", "te-ontvangen", "loonstrook", "vaste-last"].includes(documentType)
            ? documentType as DocumentType
            : "te-betalen";
        return {
          id: String(row.id),
          type,
          source: ["email", "upload", "excel"].includes(String(row.source)) ? row.source as InvoiceDocument["source"] : "upload",
          direction: type === "te-ontvangen" ? "uitgaand" as const : "inkomend" as const,
          relation: String(metadata.sender ?? "Onbekend"),
          invoiceNumber: String(metadata.invoice_number ?? ""),
          subject: String(metadata.subject ?? row.file_name ?? "Document"),
          sender: String(metadata.sender ?? "Onbekend"),
          senderEmail: String(metadata.sender_email ?? ""),
          fileName: String(row.file_name),
          mimeType: String(row.mime_type),
          receivedAt: String(row.received_at ?? "").slice(0, 10),
          dueDate: String(metadata.due_date ?? ""),
          amount: Number(metadata.amount ?? 0),
          paid: "NEE" as const,
          status: row.status === "approved" ? "Goedgekeurd" as const : row.status === "rejected" ? "Afgekeurd" as const : "Controle" as const,
          category: type,
          storagePath: String(row.storage_path),
          previewUrl: signed.data?.signedUrl,
          linkedInvoice: String(metadata.invoice_number ?? ""),
        };
      }));
      const mergedDocuments = new Map(storedDocuments.map((document) => [document.id, document]));
      fetchedDocuments.forEach((document) => mergedDocuments.set(document.id, document));
      const nextDocuments = Array.from(mergedDocuments.values());
      setInvoiceDocs(nextDocuments);
      const payrollFromDocuments: PayrollDoc[] = ((documentResult.data ?? []) as Array<Record<string, unknown>>)
        .filter((row) => String(row.document_type) === "payroll")
        .map((row) => {
          const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
          const linked = nextDocuments.find((document) => document.id === String(row.id));
          return {
            id: String(row.id),
            documentId: String(row.id),
            employee: String(metadata.sender ?? "Onbekende medewerker"),
            period: String(metadata.period ?? String(row.received_at ?? "").slice(0, 7)),
            fileName: String(row.file_name),
            uploadedAt: String(row.received_at ?? "").slice(0, 10),
            status: row.status === "approved" ? "Goedgekeurd" : row.status === "rejected" ? "Afgekeurd" : "Controle",
            gross: Number(metadata.gross ?? 0),
            net: Number(metadata.net ?? 0),
            storagePath: String(row.storage_path),
            previewUrl: linked?.previewUrl,
          };
        });
      const payrollById = new Map(storedPayrollDocuments.map((document) => [document.id, document]));
      payrollFromDocuments.forEach((document) => payrollById.set(document.id, document));
      setPayrollDocs(Array.from(payrollById.values()));
      if (nextDocuments[0]) setSelectedDocId(nextDocuments[0].id);
      setProductionHydrated(true);
    })();

    return () => { active = false; };
  }, [activeWorkspace.locationId, activeWorkspace.organizationId, activeWorkspace.organizationName, auth.mode, auth.user?.email]);

  useEffect(() => {
    if (auth.mode !== "production" || !productionHydrated) return;
    const client = getSupabaseClient();
    if (!client) return;
    const timer = window.setTimeout(async () => {
      const scope = client
        .from("workspace_snapshots")
        .select("id")
        .eq("organization_id", activeWorkspace.organizationId)
        .is("deleted_at", null);
      const scoped = activeWorkspace.locationId
        ? scope.eq("location_id", activeWorkspace.locationId)
        : scope.is("location_id", null);
      const { data: existing } = await scoped.maybeSingle();
      const payload = {
        schema_version: 1,
        data: { balances, salaries, taxes, fixedCosts, payables, receivables, payrollDocs, invoiceDocs, clientProfile, automationSettings },
      };
      if (existing?.id) await client.from("workspace_snapshots").update(payload).eq("id", existing.id);
      else await client.from("workspace_snapshots").insert({
        organization_id: activeWorkspace.organizationId,
        location_id: activeWorkspace.locationId,
        ...payload,
      });
      await Promise.all([
        client.from("organizations").update({
          name: clientProfile.companyName,
          sector: clientProfile.sector,
          logo_url: clientProfile.logoUrl || null,
          brand_color: clientProfile.brandColor,
        }).eq("id", activeWorkspace.organizationId),
        client.from("organization_settings").upsert({
          organization_id: activeWorkspace.organizationId,
          admin_email: clientProfile.adminEmail,
          bookkeeper_email: clientProfile.bookkeeperEmail,
          bank_upload_cadence: clientProfile.bankUploadCadence,
          payable_reminder_days: automationSettings.payableReminderDays,
          receivable_reminder_days: automationSettings.receivableReminderDays,
          auto_customer_email: automationSettings.autoCustomerEmail,
          preferences: { slack_channel: automationSettings.slackChannel, gmail_query: automationSettings.gmailQuery },
        }, { onConflict: "organization_id" }),
        syncWorkspaceInvoices(activeWorkspace, payables, receivables),
      ]);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    activeWorkspace.locationId,
    activeWorkspace.organizationId,
    auth.mode,
    automationSettings,
    balances,
    clientProfile,
    fixedCosts,
    invoiceDocs,
    payables,
    payrollDocs,
    productionHydrated,
    receivables,
    salaries,
    taxes,
  ]);

  useEffect(() => {
    if (!aiOpen) return;
    aiMessagesRef.current?.scrollTo({ top: aiMessagesRef.current.scrollHeight, behavior: "smooth" });
  }, [aiLoading, aiMessages, aiOpen]);

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
  const totalCashCoverage =
    totals.cash - totals.salary - totals.openTaxes - totals.openPayables - totals.fixedOpen;
  const cashAfterReceivables = totalCashCoverage + totals.expectedReceivables;
  const remainingCashGap = Math.max(0, -cashAfterReceivables);

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
  const openPayableItems = payables.filter((item) => isPaidNo(item.paid));
  const openReceivableItems = receivables.filter((item) => isPaidNo(item.paid));
  const documentByInvoice = new Map(
    invoiceDocs
      .filter((doc) => doc.linkedInvoice || doc.invoiceNumber)
      .map((doc) => [doc.linkedInvoice || doc.invoiceNumber, doc]),
  );
  const evidenceInvoiceNumbers = new Set(documentByInvoice.keys());
  const overduePayables = openPayableItems.filter((item) => {
    const deadline = parseIsoDate(item.deadline);
    return deadline ? deadline < (parseIsoDate(today) as Date) : /geweest|oud|direct|zo snel mogelijk/i.test(item.deadline);
  });
  const overdueReceivables = openReceivableItems.filter((item) => {
    const dueDate = item.dueDate || documentByInvoice.get(item.invoice)?.dueDate || "";
    const parsed = parseIsoDate(dueDate);
    return parsed ? parsed < (parseIsoDate(today) as Date) : false;
  });
  const missingDeadlineCount =
    openPayableItems.filter((item) => !parseIsoDate(item.deadline)).length +
    openReceivableItems.filter((item) => {
      const dueDate = item.dueDate || documentByInvoice.get(item.invoice)?.dueDate || "";
      return !parseIsoDate(dueDate);
    }).length;
  const missingEvidenceCount =
    openPayableItems.filter((item) => !item.documentIds?.length && !evidenceInvoiceNumbers.has(item.invoice)).length +
    openReceivableItems.filter((item) => !item.documentIds?.length && !evidenceInvoiceNumbers.has(item.invoice)).length;
  const missingPayrollCount = activeSalaries.filter(
    (salary) => !payrollDocs.some((doc) => doc.employee === salary.name),
  ).length;
  const invoiceKeys = [
    ...payables.map((item) => `payable:${item.company.toLowerCase()}:${item.invoice.toLowerCase()}`),
    ...receivables.map((item) => `receivable:${item.client.toLowerCase()}:${item.invoice.toLowerCase()}`),
  ];
  const duplicateInvoiceCount = invoiceKeys.length - new Set(invoiceKeys).size;
  const overdueAmount = sum([
    ...overduePayables.map((item) => item.amount),
    ...overdueReceivables.map((item) => item.amount),
  ]);
  const payableDueNext30 = sum(
    openPayableItems
      .filter((item) => {
        const days = daysUntil(item.deadline);
        return days !== null && days <= 30;
      })
      .map((item) => item.amount),
  );
  const receivableDueNext30 = sum(
    openReceivableItems
      .filter((item) => {
        const dueDate = item.dueDate || documentByInvoice.get(item.invoice)?.dueDate || "";
        const days = daysUntil(dueDate);
        return days !== null && days <= 30;
      })
      .map((item) => item.amount),
  );
  const taxesDueNext30 = sum(
    taxes
      .filter((item) => {
        const days = daysUntil(item.deadline);
        return isOpen(`${item.status} ${item.paid}`) && days !== null && days <= 30;
      })
      .map((item) => item.amount),
  );
  const projectedCash30 = totals.cash + receivableDueNext30 - payableDueNext30 - taxesDueNext30 - totals.salary;
  const agingBuckets = [
    { label: "1-30 dagen", min: 1, max: 30 },
    { label: "31-60 dagen", min: 31, max: 60 },
    { label: "Meer dan 60", min: 61, max: Number.POSITIVE_INFINITY },
  ].map((bucket) => {
    const payable = sum(openPayableItems.filter((item) => {
      const days = daysUntil(item.deadline);
      const overdueDays = days === null ? 0 : Math.max(0, -days);
      return overdueDays >= bucket.min && overdueDays <= bucket.max;
    }).map((item) => item.amount));
    const receivable = sum(openReceivableItems.filter((item) => {
      const dueDate = item.dueDate || documentByInvoice.get(item.invoice)?.dueDate || "";
      const days = daysUntil(dueDate);
      const overdueDays = days === null ? 0 : Math.max(0, -days);
      return overdueDays >= bucket.min && overdueDays <= bucket.max;
    }).map((item) => item.amount));
    return { ...bucket, payable, receivable };
  });
  const agingMax = Math.max(...agingBuckets.flatMap((bucket) => [bucket.payable, bucket.receivable]), 1);
  const lastBankUploadDate = parseIsoDate(clientProfile.lastBankUpload.split("·")[0]?.trim() || "");
  const bankDataAge = lastBankUploadDate
    ? Math.max(0, Math.floor(((parseIsoDate(today) as Date).getTime() - lastBankUploadDate.getTime()) / 86_400_000))
    : null;
  const bankDataNeedsRefresh = bankDataAge === null || bankDataAge > 30;
  const overviewChecks: OverviewCheck[] = [
    {
      id: "bank-freshness",
      title: "Banksaldo verversen",
      detail: "Actuele bankdata voorkomt beslissingen op een verouderd beschikbaar bedrag.",
      value: bankDataAge === null ? "Nog niet geüpload" : bankDataAge === 0 ? "Vandaag bijgewerkt" : `${bankDataAge} dagen oud`,
      tone: bankDataNeedsRefresh ? "warn" : "good",
      icon: Landmark,
      target: "onboarding",
    },
    {
      id: "overdue",
      title: "Achterstallige posten",
      detail: "Betaal- en ontvangstdatums die al verstreken zijn.",
      value: `${overduePayables.length + overdueReceivables.length} · ${euro.format(overdueAmount)}`,
      tone: overduePayables.length + overdueReceivables.length ? "danger" : "good",
      icon: CalendarClock,
      target: "facturen",
    },
    {
      id: "deadlines",
      title: "Vervaldatums aanvullen",
      detail: "Zonder exacte datum werken reminders en klantmails niet betrouwbaar.",
      value: `${missingDeadlineCount} ontbrekend`,
      tone: missingDeadlineCount ? "warn" : "good",
      icon: TimerReset,
      target: "facturen",
    },
    {
      id: "evidence",
      title: "Bewijsstukken koppelen",
      detail: "Open posten zonder gekoppelde PDF of documentrecord.",
      value: `${missingEvidenceCount} zonder bewijs`,
      tone: missingEvidenceCount ? "warn" : "good",
      icon: FileCheck2,
      target: "automation",
    },
    {
      id: "payroll",
      title: "Loondossier completeren",
      detail: "Actieve medewerkers zonder loonstrook in het dossier.",
      value: `${missingPayrollCount} medewerkers`,
      tone: missingPayrollCount ? "warn" : "good",
      icon: ReceiptText,
      target: "loonstroken",
    },
    {
      id: "duplicates",
      title: "Dubbele factuurnummers",
      detail: "Controle op dezelfde relatie en hetzelfde factuurnummer.",
      value: duplicateInvoiceCount ? `${duplicateInvoiceCount} gevonden` : "Geen gevonden",
      tone: duplicateInvoiceCount ? "danger" : "good",
      icon: duplicateInvoiceCount ? XCircle : CheckCircle2,
      target: "facturen",
    },
  ];
  const overviewIssueCount = overviewChecks.filter((item) => item.tone !== "good").length;
  const aiContext: AiContextSnapshot = {
    companyName: clientProfile.companyName,
    currentView: tab,
    period: dateRangeLabel(dateRange),
    financial: {
      available: displayTotals.cash,
      salaries: displayTotals.salary,
      openTaxes: displayTotals.openTaxes,
      openPayables: displayTotals.openPayables,
      expectedReceivables: displayTotals.expectedReceivables,
      fixedCosts: displayTotals.fixedOpen,
      cashCoverage,
    },
    counts: {
      activeEmployees: activeSalaries.length,
      payrollDocuments: payrollDocs.length,
      invoiceDocuments: invoiceDocs.length,
      openPayables: payables.filter((item) => isPaidNo(item.paid)).length,
      openReceivables: receivables.filter((item) => isPaidNo(item.paid)).length,
    },
    reminders: reminders.slice(0, 8).map((item) => ({
      relation: item.relation,
      invoice: item.invoice,
      amount: item.amount,
      dueDate: item.dueDate,
      action: item.action,
    })),
    openPayables: payables
      .filter((item) => isPaidNo(item.paid))
      .slice(0, 12)
      .map((item) => ({
        relation: item.company,
        invoice: item.invoice,
        amount: item.amount,
        deadline: item.deadline,
        priority: item.priority,
        note: item.note || "",
      })),
    openReceivables: receivables
      .filter((item) => isPaidNo(item.paid))
      .slice(0, 12)
      .map((item) => ({
        relation: item.client,
        invoice: item.invoice,
        amount: item.amount,
        dueDate: item.dueDate || "",
        action: item.action || "",
      })),
    employees: activeSalaries.map((salary) => ({
      name: salary.name,
      monthlyTotal: salary.total,
      status: salary.status || "Actief",
      payrollDocuments: payrollDocs.filter((doc) => doc.employee === salary.name).length,
    })),
    checks: overviewChecks.map(({ title, detail, value, tone }) => ({ title, detail, value, tone })),
  };

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

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const selectedEmployee = employee || activeSalaries[0]?.name;
    if (!selectedEmployee) return;
    setOperationBusy(true);
    setOperationNotice(null);
    try {
      const additions = await Promise.all(files.map(async (file, index): Promise<PayrollDoc> => {
        if (auth.mode === "production") {
          const uploaded = await uploadWorkspaceDocument(file, activeWorkspace, auth.user?.id, {
            type: "loonstrook",
            relation: selectedEmployee,
            invoiceNumber: file.name.replace(/\.[^.]+$/, ""),
            amount: 0,
            dueDate: "",
            period,
          });
          return {
            id: uploaded.id,
            employee: selectedEmployee,
            period,
            fileName: file.name,
            uploadedAt: today,
            status: "Controle",
            gross: 0,
            net: 0,
            documentId: uploaded.id,
            storagePath: uploaded.storagePath,
            previewUrl: uploaded.previewUrl,
          };
        }
        return {
          id: `${Date.now()}-${index}`,
          employee: selectedEmployee,
          period,
          fileName: file.name,
          uploadedAt: today,
          status: "Controle",
          gross: 0,
          net: 0,
          previewUrl: URL.createObjectURL(file),
        };
      }));
      setPayrollDocs((current) => [...additions, ...current]);
      setSelectedPayrollEmployee(selectedEmployee);
      setSelectedPayrollMonth(period);
      setOperationNotice({ tone: "good", message: `${additions.length} loonstrook${additions.length === 1 ? "" : "en"} veilig toegevoegd.` });
    } catch {
      setOperationNotice({ tone: "danger", message: "Upload mislukt. Controleer je 2FA, rechten en verbinding." });
    } finally {
      setOperationBusy(false);
      event.target.value = "";
    }
  }

  async function handleInvoiceFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setOperationBusy(true);
    setOperationNotice(null);
    try {
      const additions = await Promise.all(files.map(async (file, index): Promise<InvoiceDocument> => {
        const invoiceNumber = newDocument.invoiceNumber.trim() || file.name.replace(/\.[^.]+$/, "");
        const relation = newDocument.relation.trim() || "Onbekend";
        const amount = Number(newDocument.amount);
        const type = newDocument.type;
        const safeAmount = Number.isNaN(amount) ? 0 : amount;
        const uploaded = auth.mode === "production"
          ? await uploadWorkspaceDocument(file, activeWorkspace, auth.user?.id, {
              type,
              relation,
              invoiceNumber,
              amount: safeAmount,
              dueDate: newDocument.dueDate.trim(),
              customerEmail: newDocument.customerEmail.trim() || undefined,
            })
          : null;
        return {
          id: uploaded?.id ?? `uploaded-doc-${Date.now()}-${index}`,
          type,
          source: "upload",
          direction: type === "te-betalen" || type === "vaste-last" ? "inkomend" : "uitgaand",
          relation,
          invoiceNumber,
          subject: `${relation} ${invoiceNumber}`,
          sender: type === "te-ontvangen" ? clientProfile.companyName : relation,
          customerEmail: newDocument.customerEmail.trim() || undefined,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          receivedAt: today,
          dueDate: newDocument.dueDate.trim(),
          amount: safeAmount,
          paid: "NEE",
          status: "Controle",
          category: type === "vaste-last" ? "Vaste lasten" : type === "loonstrook" ? "Loonstrook" : "Factuur",
          extractedText: "Handmatig geupload. Controleer bedrag, relatie, factuurnummer en vervaldatum.",
          storagePath: uploaded?.storagePath,
          previewUrl: uploaded?.previewUrl ?? URL.createObjectURL(file),
          linkedInvoice: invoiceNumber,
        };
      }));
      setInvoiceDocs((current) => [...additions, ...current]);
      setSelectedDocId(additions[0]?.id ?? selectedDocId);
      setOperationNotice({ tone: "good", message: `${additions.length} document${additions.length === 1 ? "" : "en"} toegevoegd en gekoppeld.` });
    } catch {
      setOperationNotice({ tone: "danger", message: "Documentupload mislukt. Controleer 2FA, rechten en verbinding." });
    } finally {
      setOperationBusy(false);
      event.target.value = "";
    }
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

  async function handleBankUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setOperationBusy(true);
    setOperationNotice(null);
    try {
      const result = await parseBankFile(file);
      if (auth.mode === "production") {
        await uploadBankStatement(file, activeWorkspace, auth.user?.id, {
          transaction_count: result.transactions.length,
          first_date: result.firstDate,
          last_date: result.lastDate,
          latest_balance: result.latestBalance,
          net_movement: result.netMovement,
        });
      }
      const label = `${today} · ${file.name}`;
      setClientProfile((current) => ({ ...current, lastBankUpload: label }));
      const balanceLabel = result.latestBalance === null ? "Netto bankmutatie import" : "Banksaldo laatste regel";
      const balanceAmount = result.latestBalance ?? result.netMovement;
      setBalances((current) => [
        { label: balanceLabel, amount: balanceAmount },
        ...current.filter((item) => !["Bankbestand 30 dagen", "Netto bankmutatie import", "Banksaldo laatste regel"].includes(item.label)),
      ]);
      setOperationNotice({
        tone: result.warnings.length ? "warn" : "good",
        message: `${result.transactions.length} transacties verwerkt (${result.firstDate || "-"} t/m ${result.lastDate || "-"}). Netto mutatie ${euro.format(result.netMovement)}.`,
      });
    } catch (error) {
      setOperationNotice({ tone: "danger", message: error instanceof Error ? error.message : "Bankbestand kon niet worden verwerkt." });
    } finally {
      setOperationBusy(false);
      event.target.value = "";
    }
  }

  async function handleWorkbookImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setOperationBusy(true);
    setOperationNotice(null);
    try {
      const imported = await parseAuraWorkbook(await file.arrayBuffer());
      if (imported.balances.length) setBalances(imported.balances);
      if (imported.salaries.length) setSalaries(imported.salaries);
      if (imported.taxes.length) setTaxes(imported.taxes);
      if (imported.fixedCosts.length) setFixedCosts(imported.fixedCosts);
      if (imported.payables.length) setPayables(imported.payables);
      if (imported.receivables.length) setReceivables(imported.receivables);
      setOperationNotice({
        tone: imported.warnings.length ? "warn" : "good",
        message: `Excel verwerkt: ${imported.payables.length} te betalen en ${imported.receivables.length} te ontvangen facturen. Betaalstatus is uit kolom H/J gelezen.`,
      });
    } catch {
      setOperationNotice({ tone: "danger", message: "Excel-import mislukt. Gebruik het originele AuraWash-overzicht of hetzelfde sjabloon." });
    } finally {
      setOperationBusy(false);
      event.target.value = "";
    }
  }

  async function createBrandedInvoiceDocument() {
    const amount = Number(invoiceDraft.amount);
    if (!invoiceDraft.client.trim() || !invoiceDraft.invoiceNumber.trim() || !Number.isFinite(amount) || amount <= 0) {
      setOperationNotice({ tone: "danger", message: "Vul klant, factuurnummer en een geldig bedrag in." });
      return;
    }
    setOperationBusy(true);
    setOperationNotice(null);
    try {
      const generated = await createInvoicePdf(clientProfile, invoiceDraft, today);
      downloadBlob(generated.filename, generated.blob);
      const file = new File([generated.blob], generated.filename, { type: "application/pdf" });
      const uploaded = auth.mode === "production"
        ? await uploadWorkspaceDocument(file, activeWorkspace, auth.user?.id, {
            type: "te-ontvangen",
            relation: invoiceDraft.client.trim(),
            invoiceNumber: invoiceDraft.invoiceNumber.trim(),
            amount,
            dueDate: invoiceDraft.dueDate,
            customerEmail: invoiceDraft.email.trim() || undefined,
            approved: true,
          })
        : null;
      const document: InvoiceDocument = {
        id: uploaded?.id ?? `generated-${crypto.randomUUID()}`,
        type: "te-ontvangen",
        source: "upload",
        direction: "uitgaand",
        relation: invoiceDraft.client.trim(),
        invoiceNumber: invoiceDraft.invoiceNumber.trim(),
        subject: `${clientProfile.companyName} factuur ${invoiceDraft.invoiceNumber.trim()}`,
        sender: clientProfile.companyName,
        customerEmail: invoiceDraft.email.trim() || undefined,
        fileName: generated.filename,
        mimeType: "application/pdf",
        receivedAt: today,
        dueDate: invoiceDraft.dueDate,
        amount,
        paid: "NEE",
        status: "Goedgekeurd",
        category: "Te ontvangen factuur",
        extractedText: `Klant: ${invoiceDraft.client.trim()}. Factuur: ${invoiceDraft.invoiceNumber.trim()}. Bedrag: ${euro.format(amount)}.`,
        storagePath: uploaded?.storagePath,
        previewUrl: uploaded?.previewUrl ?? URL.createObjectURL(generated.blob),
        linkedInvoice: invoiceDraft.invoiceNumber.trim(),
      };
      setInvoiceDocs((current) => [document, ...current.filter((item) => item.invoiceNumber !== document.invoiceNumber)]);
      setSelectedDocId(document.id);
      setReceivables((current) => current.some((item) => item.invoice === invoiceDraft.invoiceNumber.trim()) ? current : [{
        client: invoiceDraft.client.trim(),
        invoice: invoiceDraft.invoiceNumber.trim(),
        amount,
        invoiceDate: today,
        dueDate: invoiceDraft.dueDate,
        status: "Goedgekeurd",
        action: "Versturen en betaling opvolgen",
        paid: "NEE",
        customerEmail: invoiceDraft.email.trim() || undefined,
        documentIds: [document.id],
      }, ...current]);
      setEmailDraft({
        to: invoiceDraft.email.trim(),
        subject: `Factuur ${invoiceDraft.invoiceNumber.trim()} van ${clientProfile.companyName}`,
        body: `Hi,\n\nIn de bijlage staat factuur ${invoiceDraft.invoiceNumber.trim()} van ${euro.format(amount)}. De uiterste betaaldatum is ${invoiceDraft.dueDate || "nog af te spreken"}.\n\nGroet,\n${clientProfile.companyName}`,
        documentId: uploaded?.id ?? "",
      });
      setOperationNotice({ tone: "good", message: "Factuur als PDF gemaakt, in het dossier gezet en aan te ontvangen gekoppeld." });
    } catch {
      setOperationNotice({ tone: "danger", message: "De factuur kon niet volledig worden gemaakt of opgeslagen." });
    } finally {
      setOperationBusy(false);
    }
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

  async function removeInvoiceDoc(id: string) {
    const document = invoiceDocs.find((doc) => doc.id === id);
    if (auth.mode === "production" && document) {
      setOperationBusy(true);
      try {
        await deleteWorkspaceDocument(id, document.storagePath);
      } catch {
        setOperationNotice({ tone: "danger", message: "Document kon niet veilig worden verwijderd." });
        setOperationBusy(false);
        return;
      }
      setOperationBusy(false);
    }
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

  async function removePayroll(id: string) {
    const document = payrollDocs.find((doc) => doc.id === id);
    if (auth.mode === "production" && document?.documentId) {
      setOperationBusy(true);
      try {
        await deleteWorkspaceDocument(document.documentId, document.storagePath);
      } catch {
        setOperationNotice({ tone: "danger", message: "Loonstrook kon niet veilig worden verwijderd." });
        setOperationBusy(false);
        return;
      }
      setOperationBusy(false);
    }
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

  function clearAiConversation() {
    setAiMessages([
      {
        id: `ai-welcome-${Date.now()}`,
        role: "assistant",
        content: "Nieuwe chat gestart. Waar kan ik je mee helpen?",
      },
    ]);
    setAiMode(null);
    setAiInput("");
  }

  async function sendAiMessage(value = aiInput) {
    const question = value.trim();
    if (!question || aiLoading) return;

    const userMessage: AiMessage = {
      id: `ai-user-${Date.now()}`,
      role: "user",
      content: question,
    };
    const requestMessages = [...aiMessages, userMessage]
      .filter((message) => message.id !== "ai-welcome")
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));

    setAiOpen(true);
    setAiInput("");
    setAiMessages((current) => [...current, userMessage]);
    setAiLoading(true);

    if (window.location.protocol === "file:") {
      setAiMode("local");
      setAiMessages((current) => [
        ...current,
        { id: `ai-local-${Date.now()}`, role: "assistant", content: localAiReply(question, aiContext) },
      ]);
      setAiLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch("/api/ai-helper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth.session?.access_token ? { Authorization: `Bearer ${auth.session.access_token}` } : {}),
        },
        body: JSON.stringify({ organizationId: activeWorkspace.organizationId, messages: requestMessages, context: aiContext }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as { answer?: string; mode?: "ai" | "local"; error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error || "AI antwoord ontbreekt");

      setAiMode(payload.mode ?? "ai");
      setAiMessages((current) => [
        ...current,
        { id: `ai-assistant-${Date.now()}`, role: "assistant", content: payload.answer as string },
      ]);
    } catch {
      setAiMode("local");
      setAiMessages((current) => [
        ...current,
        { id: `ai-local-${Date.now()}`, role: "assistant", content: localAiReply(question, aiContext) },
      ]);
    } finally {
      window.clearTimeout(timeout);
      setAiLoading(false);
    }
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

  function selectDateRangePreset(preset: DateRangePreset) {
    setDateRange(buildDateRange(preset));
    if (preset === "thisQuarter") setPeriodView("kwartaal");
    if (preset === "year" || preset === "last365") setPeriodView("jaar");
    if (["today", "yesterday", "last7", "thisMonth", "last30", "last90"].includes(preset)) {
      setPeriodView("maand");
    }
  }

  function exportJson() {
    downloadFile(
      `aurawash-instanties-pakket-${today}.json`,
      JSON.stringify(institutionPacket, null, 2),
      "application/json;charset=utf-8",
    );
  }

  async function exportAccountantZip() {
    setOperationBusy(true);
    setOperationNotice({ tone: "warn", message: "Boekhouderpakket met bewijsstukken wordt opgebouwd..." });
    try {
      const summaryHtml = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${escapeHtml(clientProfile.companyName)} boekhouderpakket</title><style>body{font:14px Inter,Arial,sans-serif;color:#0B0B0C;margin:40px}h1{font-size:34px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{background:#F5F2ED}</style></head><body><h1>${escapeHtml(clientProfile.companyName)} boekhouderpakket</h1><p>Periode: ${escapeHtml(dateRangeLabel(dateRange))} · gegenereerd ${today}</p><table><thead><tr><th>Post</th><th>Bedrag</th><th>Context</th></tr></thead><tbody>${financialMetrics.map((metric) => `<tr><td>${escapeHtml(metric.title)}</td><td>${euro.format(metric.value)}</td><td>${escapeHtml(metric.detail)}</td></tr>`).join("")}</tbody></table></body></html>`;
      await downloadAccountantPackage({
        companyName: clientProfile.companyName,
        generatedAt: today,
        period: dateRangeLabel(dateRange),
        totals: {
          beschikbaar: totals.cash,
          salarissen: totals.salary,
          belastingen_open: totals.openTaxes,
          facturen_te_betalen: totals.openPayables,
          facturen_te_ontvangen: totals.expectedReceivables,
          vaste_lasten_open: totals.fixedOpen,
          cashflow_ruimte: cashCoverage,
        },
        salaries,
        taxes,
        payables,
        receivables,
        payrollDocs,
        invoiceDocs,
        json: institutionPacket as unknown as Record<string, unknown>,
        summaryHtml,
      });
      setOperationNotice({ tone: "good", message: "Boekhouderpakket gedownload als ZIP met data en beschikbare bewijsstukken." });
    } catch {
      setOperationNotice({ tone: "danger", message: "Boekhouderpakket kon niet volledig worden opgebouwd." });
    } finally {
      setOperationBusy(false);
    }
  }

  const mailtoHref = `mailto:${encodeURIComponent(emailDraft.to)}?subject=${encodeURIComponent(
    emailDraft.subject,
  )}&body=${encodeURIComponent(emailDraft.body)}`;

  async function sendDirectEmail() {
    if (!auth.session || !emailDraft.to.includes("@") || !emailDraft.subject.trim() || !emailDraft.body.trim()) {
      setOperationNotice({ tone: "danger", message: "Vul ontvanger, onderwerp en bericht volledig in." });
      return;
    }
    setOperationBusy(true);
    setOperationNotice({ tone: "warn", message: "E-mail wordt veilig verstuurd via de gekoppelde inbox..." });
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` },
        body: JSON.stringify({ organizationId: activeWorkspace.organizationId, ...emailDraft }),
      });
      if (!response.ok) throw new Error("send_failed");
      setOperationNotice({ tone: "good", message: `E-mail verstuurd naar ${emailDraft.to}.` });
    } catch {
      setOperationNotice({ tone: "danger", message: "Direct versturen lukte niet. Controleer de e-mailkoppeling of gebruik Open e-mail." });
    } finally {
      setOperationBusy(false);
    }
  }

  const allTabItems = [
    { id: "onboarding" as const, icon: PlugZap, label: "Setup", description: "Connecties en klantprofiel" },
    { id: "overzicht" as const, icon: Gauge, label: "Overzicht", description: "Cash, kosten en deadlines" },
    { id: "loonstroken" as const, icon: ReceiptText, label: "Loonstroken", description: "Profielen en maandruns" },
    { id: "instanties" as const, icon: ClipboardList, label: "Instanties", description: "Bewijspakket en aangiftes" },
    { id: "facturen" as const, icon: WalletCards, label: "Facturen", description: "Te betalen en te ontvangen" },
    { id: "automation" as const, icon: Bot, label: "Automation", description: "Inbox, Slack en reminders" },
    { id: "email" as const, icon: Mail, label: "E-mail", description: "Templates en GitHub flow" },
    { id: "admin" as const, icon: Users, label: "Admin Center", description: "Accounts, vestigingen en security" },
  ];
  const allowedNavigation = navigationFor(activeWorkspace.role);
  const tabItems = allTabItems.filter((item) => allowedNavigation.includes(item.id));
  const activeTabItem = tabItems.find((item) => item.id === tab) ?? tabItems[0];
  const ActiveTabIcon = activeTabItem.icon;
  const visibleTourSteps = useMemo(
    () => productTourSteps.filter((step) => navigationFor(activeWorkspace.role).includes(step.tab)),
    [activeWorkspace.role],
  );

  function closeProductTour(status: "completed" | "skipped") {
    try {
      window.localStorage.setItem(productTourStorageKey, status);
    } catch {
      // The tour still closes when browser storage is unavailable.
    }
    setTourOpen(false);
  }

  function restartProductTour() {
    setAiOpen(false);
    setTourStepIndex(0);
    setTourOpen(true);
  }

  function openSetupItem(targetTab: Tab, targetId: string) {
    setTab(targetTab);
    setSetupFocus(targetId);
    window.setTimeout(() => {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = target.matches("input, button, select, textarea")
        ? target as HTMLElement
        : target.querySelector<HTMLElement>("input:not([type='hidden']):not(.hidden), button:not([disabled]), select, textarea");
      window.setTimeout(() => focusable?.focus({ preventScroll: true }), 260);
    }, targetTab === tab ? 40 : 180);
    window.setTimeout(() => setSetupFocus((current) => current === targetId ? null : current), 2_100);
  }

  useEffect(() => {
    if (!allowedNavigation.includes(tab)) setTab(tabItems[0].id);
  }, [activeWorkspace.role, tab]);

  useEffect(() => {
    if (!tourOpen) return;
    const step = visibleTourSteps[tourStepIndex];
    if (!step) {
      setTourStepIndex(0);
      return;
    }
    setAiOpen(false);
    if (tab !== step.tab) setTab(step.tab);
  }, [tourOpen, tourStepIndex, visibleTourSteps, tab]);

  useLayoutEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [tab]);

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
              <p className="text-sm font-semibold text-[#F5F2ED]">EcomVault Finance</p>
              <p className="truncate text-xs text-[#F5F2ED]/48">{clientProfile.companyName}</p>
            </div>
          </div>

          <div className="ev-workspace-switcher">
            <span>Werkruimte</span>
            <Select
              aria-label="Kies werkruimte"
              value={`${activeWorkspace.organizationId}:${activeWorkspace.locationId ?? "all"}`}
              onChange={(event) => {
                const selected = workspaces.find(
                  (workspace) => `${workspace.organizationId}:${workspace.locationId ?? "all"}` === event.target.value,
                );
                if (selected) setActiveWorkspace(selected.organizationId, selected.locationId);
              }}
            >
              {workspaces.map((workspace) => (
                <option key={`${workspace.organizationId}:${workspace.locationId ?? "all"}`} value={`${workspace.organizationId}:${workspace.locationId ?? "all"}`}>
                  {workspace.organizationName} · {workspace.locationName ?? "Alle locaties"}
                </option>
              ))}
            </Select>
            <div className="ev-workspace-meta">
              <Badge tone={auth.mode === "demo" ? "warn" : "good"}>{auth.mode === "demo" ? "Demo" : "Live"}</Badge>
              <span>{activeWorkspace.role === "owner" ? "Eigenaar" : activeWorkspace.role}</span>
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
                  aria-label={item.label}
                  title={item.label}
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
              <p className="text-sm font-semibold text-[#F5F2ED]">{systemScore}% ingericht</p>
              <p className="mt-1 text-xs leading-5 text-[#F5F2ED]/50">
                {proofCoverage}% bewijs compleet · {reminders.length} acties
              </p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#2D5BFF]" style={{ width: `${Math.max(8, Math.min(systemScore, 100))}%` }} />
            </div>
          </div>

          <div className="ev-sidebar-footer">
            <div className="ev-theme-control">
              <div>
                <span className="block text-xs font-semibold text-[#344767]">Licht / donker</span>
                <span className="block text-[11px] font-medium text-[#8392ab]">{theme === "dark" ? "Donkere modus" : "Lichte modus"}</span>
              </div>
              <SkyToggle
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                label={theme === "dark" ? "Schakel naar lichte modus" : "Schakel naar donkere modus"}
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
            {auth.mode === "production" && (
              <Button variant="ghost" className="w-full justify-center" onClick={() => void auth.signOut()}>
                <LockKeyhole size={17} />
                Veilig uitloggen
              </Button>
            )}
          </div>
        </aside>

        <section className="ev-workspace">
          <div className="ev-topbar">
            <div className="flex min-w-0 items-center gap-3">
              <div className="ev-titlebar-icon">
                <ActiveTabIcon size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="brand-display truncate text-2xl font-semibold text-[#0B0B0C] sm:text-3xl">
                  {activeTabItem.label}
                </h1>
                <p className="truncate text-sm text-neutral-500">
                  {clientProfile.companyName} · {activeTabItem.description}
                </p>
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
              <Button variant="secondary" className="ev-tour-trigger whitespace-nowrap" onClick={restartProductTour} aria-label="Start demo-rondleiding" title="Start demo-rondleiding">
                <PlayCircle size={18} />
                <span>Tour</span>
              </Button>
              <Button variant="accent" className="whitespace-nowrap" onClick={exportJson}>
                <Download size={18} />
                Export
              </Button>
              <Button variant="secondary" className="ev-mobile-ai-button whitespace-nowrap md:hidden" data-tour="ai-helper" onClick={() => setAiOpen(true)}>
                <Sparkles size={18} />
                AI
              </Button>
            </div>
          </div>

          {tab === "overzicht" && (
            <div data-tour="command-center">
              <CommandCenter
                clientName={clientProfile.companyName}
                systemScore={systemScore}
                dateLabel={dateRangeLabel(dateRange)}
                cashCoverage={cashCoverage}
                proofCoverage={proofCoverage}
                nextReminder={nextReminder}
                onOpenAutomation={() => setTab("automation")}
              />
            </div>
          )}

          {operationNotice && (
            <div
              className={cn(
                "mx-4 mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium lg:mx-6",
                operationNotice.tone === "good" && "border-emerald-200 bg-emerald-50 text-emerald-900",
                operationNotice.tone === "warn" && "border-amber-200 bg-amber-50 text-amber-900",
                operationNotice.tone === "danger" && "border-red-200 bg-red-50 text-red-900",
              )}
              role="status"
              aria-live="polite"
            >
              <span className="flex min-w-0 items-center gap-2">
                {operationBusy ? <LoaderCircle className="shrink-0 animate-spin" size={17} /> : <CheckCircle2 className="shrink-0" size={17} />}
                <span>{operationNotice.message}</span>
              </span>
              <button type="button" onClick={() => setOperationNotice(null)} aria-label="Melding sluiten" className="shrink-0 opacity-60 hover:opacity-100">
                <X size={17} />
              </button>
            </div>
          )}

        {tab === "onboarding" && (
          <section className="grid gap-5">
            <Card className="ev-setup-overview overflow-hidden border-[#0B0B0C] bg-[#0B0B0C] text-[#F5F2ED]">
              <div className="grid gap-6 p-6 lg:grid-cols-[0.95fr_1.05fr] lg:p-7">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-[#E8D9B8]/82">
                    <Settings2 size={16} />
                    Bedrijfsconfiguratie
                  </div>
                  <h2 className="brand-display mt-4 max-w-2xl text-3xl font-semibold leading-tight text-[#F5F2ED]">
                    Implementatieoverzicht
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#F5F2ED]/68">
                    Beheer hier de koppelingen, klantgegevens en veilige bankimport die nodig zijn
                    om facturen, loonstroken en deadlines automatisch te verwerken.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <MiniStat label="Configuratie" value={`${onboardingProgress}%`} />
                    <MiniStat label="Documenten" value={`${invoiceDocs.length}`} />
                    <MiniStat label="Open acties" value={`${reminders.length}`} />
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E8D9B8]/20 bg-white/[0.06] p-5 backdrop-blur" data-tour="installation-status">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#F5F2ED]/60">Installatiestatus</p>
                      <p className="mt-1 text-3xl font-semibold text-white">{onboardingProgress}% klaar</p>
                    </div>
                    <ShieldCheck className="text-[#2D5BFF]" size={30} />
                  </div>
                  <div className="mt-5 grid gap-3">
                    {connectorChecklist.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="ev-installation-link"
                        onClick={() => openSetupItem(item.tab, item.targetId)}
                        aria-label={`${item.label}: ${item.detail}. Open instelling`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-white">{item.label}</p>
                          <p className="truncate text-sm text-[#F5F2ED]/55">{item.detail}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge tone={item.done ? "good" : "warn"}>{item.done ? "Verbonden" : "Actie"}</Badge>
                          <ChevronRight size={17} aria-hidden="true" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <section className="grid gap-4 lg:grid-cols-4">
              <InstallTile icon={Mail} title="Inbox" detail="IMAP/Gmail-koppeling voor facturen, loonstroken en vaste lasten." status="Vereist" />
              <InstallTile icon={Send} title="Uitgaande e-mail" detail="Klantmails en betalingsherinneringen vanuit het eigen domein." status="Vereist" />
              <InstallTile icon={MessageSquareWarning} title="Slack" detail="Meldingen voor deadlines, controles en bankuploads." status="Vereist" />
              <InstallTile icon={LockKeyhole} title="Bankimport" detail="Veilige CSV/XLS-import zonder bankinlog in het systeem." status="Beveiligd" />
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <Card id="setup-branding" className={cn("overflow-hidden ev-setup-target", setupFocus === "setup-branding" && "ev-setup-target-focus")}>
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
                    <div id="setup-bookkeeper" className={cn("ev-setup-target", setupFocus === "setup-bookkeeper" && "ev-setup-target-focus")}>
                      <Field label="Boekhouder e-mail">
                        <Input
                          type="email"
                          value={clientProfile.bookkeeperEmail}
                          onChange={(event) => setClientProfile((current) => ({ ...current, bookkeeperEmail: event.target.value }))}
                        />
                      </Field>
                    </div>
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

              <Card id="setup-bank" className={cn("overflow-hidden ev-setup-target", setupFocus === "setup-bank" && "ev-setup-target-focus")}>
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
                  <input ref={bankInputRef} className="hidden" type="file" accept=".csv,.xlsx" onChange={handleBankUpload} />
                  <input ref={workbookInputRef} className="hidden" type="file" accept=".xlsx" onChange={handleWorkbookImport} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button variant="accent" disabled={operationBusy} onClick={() => bankInputRef.current?.click()}>
                      <Upload size={18} />
                      Bankbestand importeren
                    </Button>
                    <Button variant="secondary" disabled={operationBusy} onClick={() => workbookInputRef.current?.click()}>
                      <FileSpreadsheet size={18} />
                      Administratie Excel importeren
                    </Button>
                  </div>
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
                  <Button variant="accent" disabled={operationBusy} onClick={() => void createBrandedInvoiceDocument()}>
                    <FilePlus2 size={18} />
                    Branded factuur als PDF
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
                  <Button variant="accent" disabled={operationBusy} onClick={() => void exportAccountantZip()}>
                    <FileArchive size={18} />
                    Compleet ZIP-pakket
                  </Button>
                  <Button variant="secondary" onClick={exportAccountantReport}>
                    <Download size={18} />
                    Alleen HTML-overzicht
                  </Button>
                </div>
              </Card>
            </section>
          </section>
        )}

        {tab === "overzicht" && (
          <>
            <Card className="overflow-hidden" data-tour="period-filter">
              <SectionHeader title="Periode kiezen" note={dateRangeLabel(dateRange)} />
              <div className="grid gap-4 p-4">
                <div className="ev-period-toolbar">
                  <div className="ev-period-presets" role="group" aria-label="Snelle periode kiezen">
                  {primaryDateRangePresets.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => selectDateRangePreset(preset.key)}
                      className={cn("ev-period-preset", dateRange.preset === preset.key && "ev-period-preset-active")}
                      aria-pressed={dateRange.preset === preset.key}
                    >
                      {preset.label}
                    </button>
                  ))}
                  </div>
                  <Select
                    className={cn(
                      "ev-period-more",
                      additionalDateRangePresets.some((preset) => preset.key === dateRange.preset) && "ev-period-more-active",
                    )}
                    aria-label="Meer periodes"
                    value={additionalDateRangePresets.some((preset) => preset.key === dateRange.preset) ? dateRange.preset : ""}
                    onChange={(event) => selectDateRangePreset(event.target.value as DateRangePreset)}
                  >
                    <option value="" disabled>Meer periodes</option>
                    {additionalDateRangePresets.map((preset) => (
                      <option key={preset.key} value={preset.key}>{preset.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="ev-period-fields">
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

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1360px]:grid-cols-6">
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

              <OverviewControlCenter
                checks={overviewChecks}
                issueCount={overviewIssueCount}
                cashAfterReceivables={cashAfterReceivables}
                remainingCashGap={remainingCashGap}
                onNavigate={setTab}
              />
            </section>

            <Card className="ev-liquidity-radar overflow-hidden">
              <SectionHeader title="Liquiditeitsradar" note="Prognose en ouderdom open posten" />
              <div className="ev-liquidity-grid">
                <div className="ev-forecast-panel">
                  <div className="ev-forecast-total">
                    <span>Verwacht over 30 dagen</span>
                    <strong className={projectedCash30 < 0 ? "is-negative" : ""}>{euro.format(projectedCash30)}</strong>
                    <small>Inclusief open posten, belasting en huidige salarisrun</small>
                  </div>
                  <div className="ev-forecast-flow">
                    <div><span>Verwachte inkomsten</span><strong className="is-positive">+ {euro.format(receivableDueNext30)}</strong></div>
                    <div><span>Te betalen facturen</span><strong>- {euro.format(payableDueNext30)}</strong></div>
                    <div><span>Belasting binnen 30 dagen</span><strong>- {euro.format(taxesDueNext30)}</strong></div>
                    <div><span>Salarisreserve</span><strong>- {euro.format(totals.salary)}</strong></div>
                  </div>
                </div>
                <div className="ev-aging-panel">
                  <div className="ev-aging-legend"><span><i className="is-payable" /> Te betalen</span><span><i className="is-receivable" /> Te ontvangen</span></div>
                  {agingBuckets.map((bucket) => (
                    <div className="ev-aging-row" key={bucket.label}>
                      <span>{bucket.label}</span>
                      <div>
                        <i className="is-payable" style={{ width: `${clampPercent(bucket.payable, agingMax)}%` }} />
                        <i className="is-receivable" style={{ width: `${clampPercent(bucket.receivable, agingMax)}%` }} />
                      </div>
                      <strong>{euro.format(bucket.payable + bucket.receivable)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

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
              <Card className="overflow-hidden" data-tour="payroll-profiles">
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
                  <article key={doc.id} className="ev-payroll-document p-5">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <FileCheck2 size={18} className="text-neutral-500" />
                        <h3 className="truncate font-semibold text-neutral-950">{doc.fileName}</h3>
                        <Badge tone={doc.status === "Goedgekeurd" ? "good" : doc.status === "Afgekeurd" ? "danger" : "warn"}>{doc.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-neutral-600">
                        {doc.employee} · {doc.period}
                        {doc.payrollNumber ? ` · ${doc.payrollNumber}` : ""}
                      </p>
                    </div>

                    <div className="ev-payroll-fields">
                      <Field label="Bruto salaris">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={doc.gross}
                          onChange={(event) => updatePayroll(doc.id, { gross: Number(event.target.value) })}
                        />
                      </Field>
                      <Field label="Netto salaris">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={doc.net}
                          onChange={(event) => updatePayroll(doc.id, { net: Number(event.target.value) })}
                        />
                      </Field>
                      <Field label="Controlestatus">
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
                      </Field>
                    </div>
                    <div className="ev-payroll-actions">
                      {doc.previewUrl && (
                        <a
                          href={doc.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-neutral-950 ring-1 ring-neutral-200 transition hover:bg-neutral-100"
                        >
                          <Eye size={16} />
                          PDF
                        </a>
                      )}
                      <Button variant="accent" size="sm" onClick={() => updatePayroll(doc.id, { status: "Goedgekeurd" })}>
                        <CheckCircle2 size={16} />
                        Goedkeuren
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => updatePayroll(doc.id, { status: "Afgekeurd" })}>
                        <XCircle size={16} />
                        Afkeuren
                      </Button>
                      <Button variant="ghost" size="icon" disabled={operationBusy} onClick={() => void removePayroll(doc.id)} aria-label="Verwijder loonstrook" title="Verwijderen">
                        <X size={18} />
                      </Button>
                    </div>
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
              <Card className="overflow-hidden" data-tour="automation-settings">
                <SectionHeader title="Inbox automation" note="Gmail, PDF's, Slack en klantmail" />
                <div className="grid gap-4 p-5">
                  <div id="setup-gmail" className={cn("ev-setup-target", setupFocus === "setup-gmail" && "ev-setup-target-focus")}>
                    <Field label="Gmail account">
                      <Input
                        value={automationSettings.gmailAccount}
                        onChange={(event) =>
                          setAutomationSettings((current) => ({ ...current, gmailAccount: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Zoekregel inbox">
                    <Input
                      value={automationSettings.gmailQuery}
                      onChange={(event) =>
                        setAutomationSettings((current) => ({ ...current, gmailQuery: event.target.value }))
                      }
                    />
                  </Field>
                  <div id="setup-slack" className={cn("ev-setup-target", setupFocus === "setup-slack" && "ev-setup-target-focus")}>
                    <Field label="Slack kanaal">
                      <Input
                        value={automationSettings.slackChannel}
                        onChange={(event) =>
                          setAutomationSettings((current) => ({ ...current, slackChannel: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
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
                        onClick={() => {
                          setEmailDraft({
                            to: receivables.find((item) => item.invoice === reminder.invoice)?.customerEmail ?? "",
                            subject: `Herinnering factuur ${reminder.invoice}`,
                            body: `Hi,\n\nWe zien dat factuur ${reminder.invoice} van ${euro.format(reminder.amount)} nog open staat. Wil je deze uiterlijk ${reminder.dueDate} overboeken?\n\nGroet,\n${clientProfile.companyName}`,
                            documentId: invoiceDocs.find((document) => document.invoiceNumber === reminder.invoice || document.linkedInvoice === reminder.invoice)?.id ?? "",
                          });
                          setTab("email");
                        }}
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
              <div className="ev-document-workspace">
                <div className="ev-document-sidebar">
                  <div className="ev-document-list">
                    {invoiceDocs.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={cn(
                          "ev-document-item",
                          selectedDoc?.id === doc.id && "is-active",
                        )}
                      >
                        <div className="ev-document-item-head">
                          <span>{doc.relation}</span>
                          <Badge tone={doc.paid === "NEE" ? "danger" : "good"}>{doc.paid}</Badge>
                        </div>
                        <span className="ev-document-item-file">{doc.invoiceNumber} · {doc.fileName}</span>
                        <span className="ev-document-item-meta">{doc.type} · {doc.source}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDoc && (
                  <div className="ev-document-detail">
                    <div className="ev-document-detail-head">
                      <div className="min-w-0">
                        <div className="ev-document-title">
                          <FileText size={20} className="text-neutral-500" />
                          <h2>{selectedDoc.fileName}</h2>
                        </div>
                        <p>{selectedDoc.subject}</p>
                      </div>
                      <div className="ev-document-actions">
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
                        <Button variant="danger" size="sm" disabled={operationBusy} onClick={() => void removeInvoiceDoc(selectedDoc.id)}>
                          <X size={16} />
                          Verwijder
                        </Button>
                      </div>
                    </div>

                    <div className="ev-document-fields">
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

                    <div className="ev-document-metadata">
                      <Preview label="Afzender" value={`${selectedDoc.sender}${selectedDoc.senderEmail ? ` · ${selectedDoc.senderEmail}` : ""}`} />
                      <Preview label="Ontvangen" value={selectedDoc.receivedAt} />
                      <Preview label="Opslag" value={selectedDoc.storagePath || "Upload in browser-sessie"} wide />
                      <Preview label="Extractie" value={selectedDoc.extractedText || "Nog geen tekstextractie beschikbaar"} wide />
                    </div>

                    {selectedDoc.previewUrl ? (
                      <iframe
                        title={selectedDoc.fileName}
                        src={selectedDoc.previewUrl}
                        className="ev-document-preview"
                      />
                    ) : (
                      <div className="ev-document-empty-preview">
                        <FileText size={24} />
                        <strong>Geen browserpreview beschikbaar</strong>
                        <span>Het document blijft gekoppeld aan dit dossier en kan vanuit de opslag worden geopend.</span>
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
                    Maak hier de e-mail klaar en verstuur via de gekoppelde Google- of Microsoft-inbox.
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
                <Preview
                  label="Bijlage"
                  value={emailDraft.documentId
                    ? invoiceDocs.find((document) => document.id === emailDraft.documentId)?.fileName ?? "Gekoppeld document"
                    : "Geen bijlage gekoppeld"}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {auth.mode === "production" && (
                    <Button variant="accent" disabled={operationBusy} onClick={() => void sendDirectEmail()}>
                      <Send size={18} />
                      Direct versturen
                    </Button>
                  )}
                  <a
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-neutral-950 ring-1 ring-neutral-200 transition hover:bg-neutral-100"
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
          <section className="ev-invoice-page">
            <Card className="ev-invoice-command" data-tour="invoice-control">
              <div className="ev-invoice-command-head">
                <div className="ev-invoice-command-copy">
                  <span className="ev-section-icon"><ReceiptText size={18} /></span>
                  <div>
                    <h2>Facturen</h2>
                    <p>Controleer betalingen, deadlines en bewijsstukken vanuit één werkruimte.</p>
                  </div>
                </div>
                <div className="ev-invoice-search">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek op relatie of factuur" />
                </div>
              </div>
              <div className="ev-invoice-overview">
                <button
                  type="button"
                  className={cn("ev-invoice-view", invoiceLedgerView === "payables" && "is-active")}
                  onClick={() => setInvoiceLedgerView("payables")}
                >
                  <span>Te betalen</span>
                  <strong>{euro.format(totals.openPayables)}</strong>
                  <small>{openPayableItems.length} open · kolom H</small>
                </button>
                <button
                  type="button"
                  className={cn("ev-invoice-view", invoiceLedgerView === "receivables" && "is-active")}
                  onClick={() => setInvoiceLedgerView("receivables")}
                >
                  <span>Te ontvangen</span>
                  <strong>{euro.format(totals.expectedReceivables)}</strong>
                  <small>{openReceivableItems.length} open · kolom J</small>
                </button>
                <div className="ev-invoice-health">
                  <span>Bewijsdekking</span>
                  <strong>{proofCoverage}%</strong>
                  <small>{linkedDocumentCount} documenten gekoppeld</small>
                </div>
              </div>
            </Card>

            <Card className="ev-invoice-ledger">
              <div className="ev-invoice-ledger-head">
                <div>
                  <span>{invoiceLedgerView === "payables" ? "Uitgaande verplichtingen" : "Inkomende betalingen"}</span>
                  <h3>{invoiceLedgerView === "payables" ? "Te betalen facturen" : "Te ontvangen facturen"}</h3>
                </div>
                <Badge tone={invoiceLedgerView === "payables" ? "warn" : "good"}>
                  {invoiceLedgerView === "payables" ? "Bron: kolom H" : "Bron: kolom J"}
                </Badge>
              </div>

              <div className="ev-invoice-ledger-columns" aria-hidden="true">
                <span>Relatie & factuur</span>
                <span>Bedrag & deadline</span>
                <span>Behandeling</span>
                <span>Betaald</span>
                <span>Bewijs</span>
              </div>

              <div className="ev-invoice-ledger-body">
                {invoiceLedgerView === "payables" && filteredPayables.map(({ item, index }) => {
                  const matchingDoc = invoiceDocs.find((doc) => doc.invoiceNumber === item.invoice || doc.linkedInvoice === item.invoice);
                  return (
                    <article className="ev-invoice-row" key={`${item.company}-${item.invoice}`}>
                      <div className="ev-invoice-identity">
                        <span className="ev-invoice-avatar"><Building2 size={17} /></span>
                        <div>
                          <strong>{item.company}</strong>
                          <span>{item.invoice}</span>
                          {item.note && <small title={item.note}>{item.note}</small>}
                        </div>
                      </div>
                      <div className="ev-invoice-money">
                        <strong>{euro.format(item.amount)}</strong>
                        <span><CalendarClock size={14} /> {item.deadline || "Geen deadline"}</span>
                      </div>
                      <div className="ev-invoice-treatment">
                        <Badge tone={statusTone(item.priority)}>{item.priority}</Badge>
                        <Select
                          aria-label={`Status ${item.company}`}
                          value={item.status}
                          onChange={(event) => setPayables((current) => updateIndex(current, index, { status: event.target.value }))}
                        >
                          <option>OPEN</option>
                          <option>Open</option>
                          <option>Betaald</option>
                          <option>in behandeling</option>
                        </Select>
                      </div>
                      <div className="ev-invoice-paid">
                        <small>Kolom H</small>
                        <PaidSelect
                          value={item.paid}
                          onChange={(paid) => setPayables((current) => updateIndex(current, index, {
                            paid,
                            status: paid === "NEE" ? "OPEN" : "Betaald",
                          }))}
                        />
                      </div>
                      <div className="ev-invoice-document-action">
                        {matchingDoc ? (
                          <Button variant="secondary" size="sm" onClick={() => {
                            setSelectedDocId(matchingDoc.id);
                            setTab("automation");
                          }}>
                            <Eye size={16} /> Dossier
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => {
                            setNewDocument((current) => ({ ...current, type: "te-betalen", relation: item.company, invoiceNumber: item.invoice, amount: String(item.amount), dueDate: item.deadline }));
                            setTab("automation");
                          }}>
                            <FilePlus2 size={16} /> PDF toevoegen
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}

                {invoiceLedgerView === "receivables" && filteredReceivables.map(({ item, index }) => {
                  const matchingDoc = invoiceDocs.find((doc) => doc.invoiceNumber === item.invoice || doc.linkedInvoice === item.invoice);
                  return (
                    <article className="ev-invoice-row" key={`${item.client}-${item.invoice}`}>
                      <div className="ev-invoice-identity">
                        <span className="ev-invoice-avatar"><UserRound size={17} /></span>
                        <div>
                          <strong>{item.client}</strong>
                          <span>{item.invoice}</span>
                          {item.action && <small title={item.action}>{item.action}</small>}
                        </div>
                      </div>
                      <div className="ev-invoice-money">
                        <strong>{euro.format(item.amount)}</strong>
                        <span><CalendarClock size={14} /> {item.dueDate || "Geen vervaldatum"}</span>
                      </div>
                      <div className="ev-invoice-treatment">
                        <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                        <Select
                          aria-label={`Status ${item.client}`}
                          value={item.status}
                          onChange={(event) => setReceivables((current) => updateIndex(current, index, { status: event.target.value }))}
                        >
                          <option>in behandeling</option>
                          <option>Betaald</option>
                          <option>Open</option>
                        </Select>
                      </div>
                      <div className="ev-invoice-paid">
                        <small>Kolom J</small>
                        <PaidSelect
                          value={item.paid}
                          onChange={(paid) => setReceivables((current) => updateIndex(current, index, {
                            paid,
                            status: paid === "NEE" ? "in behandeling" : "Betaald",
                          }))}
                        />
                      </div>
                      <div className="ev-invoice-document-action">
                        {matchingDoc ? (
                          <Button variant="secondary" size="sm" onClick={() => {
                            setSelectedDocId(matchingDoc.id);
                            setTab("automation");
                          }}>
                            <Eye size={16} /> Dossier
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => {
                            setNewDocument((current) => ({ ...current, type: "te-ontvangen", relation: item.client, invoiceNumber: item.invoice, amount: String(item.amount), dueDate: item.dueDate }));
                            setTab("automation");
                          }}>
                            <FilePlus2 size={16} /> PDF toevoegen
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}

                {((invoiceLedgerView === "payables" && !filteredPayables.length) ||
                  (invoiceLedgerView === "receivables" && !filteredReceivables.length)) && (
                  <div className="ev-invoice-empty">Geen facturen gevonden voor deze zoekopdracht.</div>
                )}
              </div>

              <div className="ev-invoice-add">
                <div className="ev-invoice-add-title">
                  <Plus size={17} />
                  <div>
                    <strong>{invoiceLedgerView === "payables" ? "Nieuwe te betalen factuur" : "Nieuwe te ontvangen factuur"}</strong>
                    <span>Voeg de basis toe; het bewijsstuk kan daarna worden gekoppeld.</span>
                  </div>
                </div>
                {invoiceLedgerView === "payables" ? (
                  <div className="ev-invoice-add-fields">
                    <Input value={newPayable.company} onChange={(event) => setNewPayable((current) => ({ ...current, company: event.target.value }))} placeholder="Leverancier" />
                    <Input value={newPayable.invoice} onChange={(event) => setNewPayable((current) => ({ ...current, invoice: event.target.value }))} placeholder="Factuurnummer" />
                    <Input type="number" step="0.01" value={newPayable.amount} onChange={(event) => setNewPayable((current) => ({ ...current, amount: event.target.value }))} placeholder="Bedrag" />
                    <Input type="date" value={newPayable.deadline} onChange={(event) => setNewPayable((current) => ({ ...current, deadline: event.target.value }))} aria-label="Deadline" />
                    <Button variant="accent" onClick={addPayable}><Plus size={16} /> Toevoegen</Button>
                  </div>
                ) : (
                  <div className="ev-invoice-add-fields">
                    <Input value={newReceivable.client} onChange={(event) => setNewReceivable((current) => ({ ...current, client: event.target.value }))} placeholder="Klant" />
                    <Input value={newReceivable.invoice} onChange={(event) => setNewReceivable((current) => ({ ...current, invoice: event.target.value }))} placeholder="Factuurnummer" />
                    <Input type="number" step="0.01" value={newReceivable.amount} onChange={(event) => setNewReceivable((current) => ({ ...current, amount: event.target.value }))} placeholder="Bedrag" />
                    <Input type="date" value={newReceivable.dueDate} onChange={(event) => setNewReceivable((current) => ({ ...current, dueDate: event.target.value }))} aria-label="Vervaldatum" />
                    <Button variant="accent" onClick={addReceivable}><Plus size={16} /> Toevoegen</Button>
                  </div>
                )}
              </div>
            </Card>
          </section>
        )}
        {tab === "admin" && <PlatformAdminCenter bankImported={Boolean(clientProfile.lastBankUpload)} onOpenSetup={() => setTab("onboarding")} />}
        </section>
      </div>

      <AiHelper
        open={aiOpen}
        messages={aiMessages}
        input={aiInput}
        loading={aiLoading}
        mode={aiMode}
        messagesRef={aiMessagesRef}
        onOpenChange={setAiOpen}
        onInputChange={setAiInput}
        onSubmit={sendAiMessage}
        onClear={clearAiConversation}
      />
      <ProductTour
        open={tourOpen}
        steps={visibleTourSteps}
        stepIndex={tourStepIndex}
        onStepChange={setTourStepIndex}
        onSkip={() => closeProductTour("skipped")}
        onFinish={() => closeProductTour("completed")}
      />
    </main>
  );
}

function AiHelper({
  open,
  messages,
  input,
  loading,
  mode,
  messagesRef,
  onOpenChange,
  onInputChange,
  onSubmit,
  onClear,
}: {
  open: boolean;
  messages: AiMessage[];
  input: string;
  loading: boolean;
  mode: "ai" | "local" | null;
  messagesRef: React.RefObject<HTMLDivElement | null>;
  onOpenChange: (open: boolean) => void;
  onInputChange: (value: string) => void;
  onSubmit: (value?: string) => void;
  onClear: () => void;
}) {
  const suggestions = [
    "Wat moet ik vandaag doen?",
    "Welke facturen staan open?",
    "Wat mist er in mijn administratie?",
    "Hoe staat mijn cashruimte?",
  ];

  return (
    <div className={cn("ev-ai-layer", open && "ev-ai-layer-open")}>
      {open && (
        <section className="ev-ai-panel" role="dialog" aria-label="EcomVault AI helper">
          <header className="ev-ai-header">
            <div className="flex min-w-0 items-center gap-3">
              <div className="ev-ai-avatar"><Sparkles size={19} /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-[#0B0B0C]">EcomVault AI</h2>
                  <span className={cn("ev-ai-status", mode === "ai" && "ev-ai-status-live")}>
                    {mode === "ai" ? "Groq Free" : mode === "local" ? "Lokaal" : "Klaar"}
                  </span>
                </div>
                <p className="truncate text-xs text-neutral-500">Assistent voor je administratie</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="ev-ai-icon-button" onClick={onClear} aria-label="Nieuwe AI-chat" title="Nieuwe chat">
                <RotateCcw size={17} />
              </button>
              <button type="button" className="ev-ai-icon-button" onClick={() => onOpenChange(false)} aria-label="Sluit AI-helper" title="Sluiten">
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="ev-ai-messages" ref={messagesRef} aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={cn("ev-ai-message", `ev-ai-message-${message.role}`)}>
                {message.role === "assistant" && <span className="ev-ai-message-icon"><Bot size={15} /></span>}
                <p>{message.content}</p>
              </article>
            ))}
            {messages.length === 1 && (
              <div className="ev-ai-suggestions">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => onSubmit(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {loading && (
              <div className="ev-ai-thinking">
                <LoaderCircle size={16} className="animate-spin" />
                Antwoord voorbereiden
              </div>
            )}
          </div>

          <form
            className="ev-ai-composer"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <textarea
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              rows={1}
              maxLength={2_000}
              placeholder="Vraag iets over je administratie"
              aria-label="Vraag aan EcomVault AI"
            />
            <button type="submit" disabled={!input.trim() || loading} aria-label="Verstuur vraag">
              <Send size={18} />
            </button>
          </form>
          <p className="ev-ai-disclaimer">Alleen-lezen · controleer belangrijke financiële beslissingen</p>
        </section>
      )}

      <button
        type="button"
        className="ev-ai-launcher"
        data-tour="ai-helper"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? "Verberg AI-helper" : "Open AI-helper"}
        aria-expanded={open}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
        <span>{open ? "Sluiten" : "Vraag AI"}</span>
      </button>
    </div>
  );
}

function OverviewControlCenter({
  checks,
  issueCount,
  cashAfterReceivables,
  remainingCashGap,
  onNavigate,
}: {
  checks: OverviewCheck[];
  issueCount: number;
  cashAfterReceivables: number;
  remainingCashGap: number;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <Card className="ev-control-center overflow-hidden">
      <SectionHeader
        title="Controlecentrum"
        note={issueCount ? `${issueCount} controles vragen aandacht` : "Alle controles staan op groen"}
      />
      <div className={cn("ev-control-cash", cashAfterReceivables < 0 && "ev-control-cash-danger")}>
        <div>
          <p>Verwachte eindpositie</p>
          <span>Volledig open dossier, los van de gekozen grafiekperiode</span>
        </div>
        <div className="text-right">
          <strong>{euro.format(cashAfterReceivables)}</strong>
          <span>
            {remainingCashGap
              ? `Nog ${euro.format(remainingCashGap)} tekort`
              : "Verplichtingen volledig gedekt"}
          </span>
        </div>
      </div>
      <div className="ev-control-list">
        {checks.map((check) => {
          const Icon = check.icon;
          return (
            <button
              key={check.id}
              type="button"
              className="ev-control-row"
              onClick={() => onNavigate(check.target)}
              aria-label={`${check.title}: ${check.value}. Open ${check.target}`}
            >
              <span className={cn("ev-control-icon", `ev-control-icon-${check.tone}`)}>
                <Icon size={17} />
              </span>
              <span className="ev-control-copy">
                <strong>{check.title}</strong>
                <small>{check.detail}</small>
              </span>
              <span className={cn("ev-control-value", `ev-control-value-${check.tone}`)}>{check.value}</span>
              <ChevronRight className="ev-control-chevron" size={17} />
            </button>
          );
        })}
      </div>
    </Card>
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
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", active ? "text-[#E8D9B8]" : "text-neutral-500")}>{title}</p>
          <p className={cn("mt-2 break-words text-2xl font-bold", active ? "text-white" : "text-neutral-950")}>{value}</p>
          <p className={cn("mt-1 text-sm", active ? "text-[#F5F2ED]/65" : "text-neutral-600")}>{detail}</p>
        </div>
        <div className={cn("shrink-0 rounded-md p-2", active ? "bg-[#2D5BFF] text-white" : danger ? "bg-red-100 text-red-700" : "bg-[#2D5BFF]/10 text-[#2D5BFF]")}>
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
          "min-w-0 overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5",
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
    <div className="ev-paid-toggle" role="group" aria-label="Betaalstatus">
      <button
        type="button"
        className={cn((paid === "JA" || paid === "JA (termijn)") && "is-paid")}
        aria-pressed={paid === "JA" || paid === "JA (termijn)"}
        onClick={() => onChange("JA")}
      >
        JA
      </button>
      <button
        type="button"
        className={cn(paid === "NEE" && "is-unpaid")}
        aria-pressed={paid === "NEE"}
        onClick={() => onChange("NEE")}
      >
        NEE
      </button>
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
