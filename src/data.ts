export type Salary = {
  name: string;
  salary: number;
  holidayPay: number | null;
  total: number;
  status?: "Actief" | "Uit dienst";
};

export type TaxItem = {
  type: string;
  amount: number;
  deadline: string;
  arrangement: string;
  priority: string;
  status: string;
  paid: string;
};

export type Payable = {
  company: string;
  invoice: string;
  amount: number;
  deadline: string;
  priority: string;
  status: string;
  note: string;
  paid: string;
  documentIds?: string[];
};

export type Receivable = {
  client: string;
  invoice: string;
  amount: number;
  invoiceDate: string;
  dueDate: string;
  status: string;
  action: string;
  paid: string;
  customerEmail?: string;
  documentIds?: string[];
};

export type PayrollDoc = {
  id: string;
  employee: string;
  period: string;
  fileName: string;
  uploadedAt: string;
  status: "Controle" | "Goedgekeurd" | "Afgekeurd" | "Ontbreekt";
  gross: number;
  net: number;
  payrollNumber?: string;
  role?: string;
};

export type InvoiceDocument = {
  id: string;
  type: "te-betalen" | "te-ontvangen" | "loonstrook" | "vaste-last";
  source: "email" | "upload" | "excel";
  direction: "uitgaand" | "inkomend";
  relation: string;
  invoiceNumber: string;
  subject: string;
  sender: string;
  senderEmail?: string;
  customerEmail?: string;
  fileName: string;
  mimeType: string;
  receivedAt: string;
  dueDate: string;
  amount: number;
  paid: "JA" | "NEE" | "JA (termijn)";
  status: "Nieuw" | "Controle" | "Goedgekeurd" | "Afgekeurd" | "Betaald" | "Niet betaald";
  category: string;
  extractedText?: string;
  storagePath?: string;
  previewUrl?: string;
  linkedInvoice?: string;
  reminderLog?: string[];
};

export const balances = [
  { label: "AuraWash rekening", amount: 1652.38 },
  { label: "B&T Customs rekening", amount: 446.97 },
  { label: "Contant geld", amount: 3135 },
];

export const salaries: Salary[] = [
  { name: "Utku Usta", salary: 1400, holidayPay: null, total: 1400 },
  { name: "Anas Murabe", salary: 2264.72, holidayPay: null, total: 2264.72 },
  { name: "Erdogan", salary: 2487.71, holidayPay: null, total: 2487.71 },
  { name: "Boris", salary: 2200, holidayPay: null, total: 2200 },
  { name: "Khaled Ali", salary: 1600, holidayPay: null, total: 1600 },
];

export const taxes: TaxItem[] = [
  { type: "BTW Q2 2025", amount: 6224, deadline: "oud", arrangement: "JA", priority: "Laag", status: "loopt", paid: "JA (termijn)" },
  { type: "LB dec 2025", amount: 5239, deadline: "oud", arrangement: "JA", priority: "Laag", status: "loopt", paid: "JA (termijn)" },
  { type: "BTW okt-dec 2025", amount: 3491, deadline: "direct", arrangement: "NEE", priority: "HOOG", status: "Betaald", paid: "JA" },
  { type: "LB jan 2026", amount: 5923, deadline: "zo snel mogelijk", arrangement: "NEE", priority: "Hoog", status: "open", paid: "NEE" },
  { type: "LB feb 2026", amount: 4974, deadline: "zo snel mogelijk", arrangement: "NEE", priority: "Hoog", status: "open", paid: "NEE" },
  { type: "BTW Q1 2026", amount: 11934, deadline: "SPOED 8 juli", arrangement: "ONBEKEND", priority: "HOOG", status: "Betaald", paid: "JA" },
  { type: "LB April 2026", amount: 6142, deadline: "2026-05-31", arrangement: "NEE", priority: "Hoog", status: "niet betaald", paid: "NEE" },
  { type: "LB Juni 2026", amount: 5385, deadline: "2026-07-31", arrangement: "NEE", priority: "Hoog", status: "niet betaald", paid: "JA" },
  { type: "BTW Q2 2026", amount: 10550, deadline: "-", arrangement: "NEE", priority: "Hoog", status: "niet betaald", paid: "NEE" },
];

export const fixedCosts = [
  { company: "Nationale Nederlanden", monthly: 333.91, automatic: "JA", importance: "Hoog", status: "Actief", open: 0, note: "" },
  { company: "Vodafone", monthly: 25.41, automatic: "JA", importance: "Middel", status: "Actief", open: 0, note: "" },
  { company: "Goudse schadevzg", monthly: 411.24, automatic: "JA", importance: "Hoog", status: "Actief", open: 0, note: "" },
  { company: "Kostn Zakelijk verkeer", monthly: 35, automatic: "JA", importance: "Middel", status: "Actief", open: 0, note: "" },
  { company: "Baptista Carwash Systems", monthly: 347.72, automatic: "nee maandelijks", importance: "Hoog", status: "open", open: 347.72, note: "Openstaande facturen" },
  { company: "Mega Technics onderhoud", monthly: 90.75, automatic: "nee maandelijks", importance: "Hoog", status: "open", open: 181.5, note: "Openstaande facturen" },
  { company: "Boekhouder", monthly: 487.03, automatic: "nee maandelijks", importance: "Hoog", status: "Open", open: 3363.82, note: "meerdere maanden achterstand" },
];

export const payables: Payable[] = [
  { company: "Cartec", invoice: "70954", amount: 2191.75, deadline: "2026-04-27", priority: "gemiddeld", status: "Open", note: "Poetsproducten voorraad", paid: "NEE" },
  { company: "Profclean Europe", invoice: "F/2026/01774", amount: 1256.86, deadline: "2026-05-17", priority: "gemiddeld", status: "Open", note: "poetsproducten", paid: "NEE" },
  { company: "Mega Technics", invoice: "260719", amount: 90.75, deadline: "2026-04-21", priority: "Laag", status: "Betaald", note: "Onderhoudsabonnement wasmachine", paid: "JA" },
  { company: "Mega Technics", invoice: "260890", amount: 90.75, deadline: "2026-05-21", priority: "Laag", status: "Betaald", note: "Onderhoudsabonnement wasmachine", paid: "JA" },
  { company: "Bapista Carwash", invoice: "26088", amount: 347.72, deadline: "2026-05-26", priority: "Middel", status: "Betaald", note: "Lease autowasmachin", paid: "JA" },
  { company: "Workroem", invoice: "1850024", amount: 5488.56, deadline: "Geweest", priority: "Hoog", status: "OPEN", note: "uitzendbureau", paid: "NEE" },
  { company: "Box B.V.", invoice: "26113021", amount: 437.4, deadline: "geweest", priority: "Hoog", status: "OPEN", note: "container", paid: "NEE" },
  { company: "Boekhouder", invoice: "26157", amount: 487.03, deadline: "geweest", priority: "Hoog", status: "OPEN", note: "boekhouder", paid: "NEE" },
  { company: "Boekhouder", invoice: "26226", amount: 487.03, deadline: "2026-06-12", priority: "middel", status: "OPEN", note: "boekhouder", paid: "NEE" },
  { company: "Fortune", invoice: "250102714", amount: 240.8, deadline: "auto incasso 14 dag", priority: "middel", status: "OPEN", note: "koffie", paid: "NEE" },
  { company: "Bapista Carwash", invoice: "26112", amount: 347.72, deadline: "2026-06-24", priority: "laag", status: "OPEN", note: "Onderhoudsabonnement wasmachine", paid: "NEE" },
  { company: "Mega Technics", invoice: "261189", amount: 90.75, deadline: "2026-06-20", priority: "laag", status: "OPEN", note: "Onderhoudsabonnement wasmachine", paid: "NEE" },
  { company: "Van der Donk", invoice: "261V03660", amount: 179.69, deadline: "2026-08-12", priority: "laag", status: "OPEN", note: "", paid: "NEE" },
];

export const receivables: Receivable[] = [
  { client: "Udenhout", invoice: "VF260015", amount: 5256.47, invoiceDate: "2026-04-13", dueDate: "2026-04-27", status: "Betaald", action: "Gebeld, betaling verwacht vandaag of morgen", paid: "JA" },
  { client: "Udenhout", invoice: "VF260017", amount: 4014.49, invoiceDate: "2026-04-27", dueDate: "2026-05-11", status: "Betaald", action: "Gebeld, wanneer niet duidelijk", paid: "JA" },
  { client: "Udenhout", invoice: "VF260019", amount: 3154.22, invoiceDate: "2026-05-04", dueDate: "2026-05-18", status: "Betaald", action: "", paid: "JA" },
  { client: "Udenhout", invoice: "VF260020", amount: 4819.08, invoiceDate: "2026-05-11", dueDate: "", status: "Betaald", action: "", paid: "JA" },
  { client: "Usta bouw", invoice: "VF260021", amount: 4840, invoiceDate: "", dueDate: "", status: "Betaald", action: "spoed", paid: "JA" },
  { client: "Udenhout", invoice: "VF260022", amount: 7415.03, invoiceDate: "2026-05-18", dueDate: "", status: "Betaald", action: "", paid: "JA" },
  { client: "Udenhout", invoice: "VF260023", amount: 6325.41, invoiceDate: "2026-05-25", dueDate: "", status: "Betaald", action: "afwachten", paid: "JA" },
  { client: "Udenhout", invoice: "VF260024", amount: 6168.17, invoiceDate: "", dueDate: "", status: "Betaald", action: "afwachten", paid: "JA" },
  { client: "Porsche CB", invoice: "VF260025", amount: 10877.9, invoiceDate: "2026-06-22", dueDate: "", status: "Betaald", action: "afwachten", paid: "JA" },
  { client: "Udenhout", invoice: "VF260026", amount: 4765.25, invoiceDate: "", dueDate: "", status: "Betaald", action: "afwachten", paid: "JA" },
  { client: "Udenhout", invoice: "VF260027", amount: 5390.74, invoiceDate: "", dueDate: "", status: "Betaald", action: "afwachten", paid: "JA" },
  { client: "Udenhout", invoice: "VF260028", amount: 5865.67, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "JA" },
  { client: "Shishacompany", invoice: "VF260029", amount: 1149.5, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "NEE" },
  { client: "Udenhout", invoice: "VF260030", amount: 2331.48, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "JA" },
  { client: "Udenhout", invoice: "VF260031", amount: 3390.78, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "JA" },
  { client: "Udenhout", invoice: "VF260032", amount: 5606.75, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "JA" },
  { client: "Porsche CB", invoice: "VF260033", amount: 3188.35, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "NEE" },
  { client: "Porsche CB", invoice: "VF260034", amount: 4398.35, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "NEE" },
  { client: "Udenhout", invoice: "VF260035", amount: 4275.2, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "NEE" },
  { client: "Porsche CB", invoice: "VF260036", amount: 6600.55, invoiceDate: "", dueDate: "", status: "Betaald", action: "afwachten", paid: "JA" },
  { client: "Udenhout", invoice: "VF260037", amount: 4666.04, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "NEE" },
  { client: "Porsche CB", invoice: "VF260038", amount: 5033.6, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "NEE" },
  { client: "Udenhout", invoice: "VF260039", amount: 3001.73, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "NEE" },
  { client: "Udenhout", invoice: "VF260040", amount: 6278.3, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "NEE" },
  { client: "Porsche CB", invoice: "VF260041", amount: 2522.85, invoiceDate: "", dueDate: "", status: "in behandeling", action: "afwachten", paid: "NEE" },
];

export const samplePayrollDocs: PayrollDoc[] = [
  {
    id: "sample-115",
    employee: "Anas Murabe",
    period: "07 = Juli 2026",
    fileName: "115 Murabe-A.--P07.pdf",
    uploadedAt: "2026-08-16",
    status: "Goedgekeurd",
    gross: 2598.27,
    net: 2296.45,
    payrollNumber: "115wn0005",
    role: "Autopoetser",
  },
];

export const sampleInvoiceDocuments: InvoiceDocument[] = [
  {
    id: "doc-cartec-70954",
    type: "te-betalen",
    source: "email",
    direction: "inkomend",
    relation: "Cartec",
    invoiceNumber: "70954",
    subject: "Factuur 70954 - Cartec",
    sender: "Cartec",
    senderEmail: "administratie@cartec.nl",
    fileName: "2026-04-13 Cartec - Factuur 70954.pdf",
    mimeType: "application/pdf",
    receivedAt: "2026-04-13",
    dueDate: "2026-04-27",
    amount: 2191.75,
    paid: "NEE",
    status: "Niet betaald",
    category: "Poetsproducten",
    extractedText: "Leverancier: Cartec. Factuur: 70954. Bedrag: EUR 2.191,75. Vervaldatum: 2026-04-27.",
    storagePath: "automation/documents/2026-04/2026-04-13 Cartec - Factuur 70954.pdf",
    linkedInvoice: "70954",
    reminderLog: ["Slack-alert 5 dagen vooraf"],
  },
  {
    id: "doc-shisha-vf260029",
    type: "te-ontvangen",
    source: "email",
    direction: "uitgaand",
    relation: "Shishacompany",
    invoiceNumber: "VF260029",
    subject: "AuraWash factuur VF260029",
    sender: "AuraWash",
    customerEmail: "administratie@shishacompany.nl",
    fileName: "2026-06-30 AuraWash - Factuur VF260029.pdf",
    mimeType: "application/pdf",
    receivedAt: "2026-06-30",
    dueDate: "2026-07-14",
    amount: 1149.5,
    paid: "NEE",
    status: "Controle",
    category: "Te ontvangen factuur",
    extractedText: "Klant: Shishacompany. Factuur: VF260029. Bedrag: EUR 1.149,50. Betaald: NEE.",
    storagePath: "automation/documents/2026-06/2026-06-30 AuraWash - Factuur VF260029.pdf",
    linkedInvoice: "VF260029",
    reminderLog: ["Slack-alert 3 dagen vooraf", "Klantmail klaarzetten"],
  },
  {
    id: "doc-payroll-anas-p07",
    type: "loonstrook",
    source: "upload",
    direction: "uitgaand",
    relation: "Anas Murabe",
    invoiceNumber: "115wn0005",
    subject: "Loonstrook Anas Murabe P07",
    sender: "AuraWash",
    fileName: "115 Murabe-A.--P07.pdf",
    mimeType: "application/pdf",
    receivedAt: "2026-08-16",
    dueDate: "2026-07-31",
    amount: 2296.45,
    paid: "JA",
    status: "Goedgekeurd",
    category: "Loonstrook",
    extractedText: "Medewerker: Anas Murabe. Periode: 07 = Juli 2026. Netto: EUR 2.296,45.",
    storagePath: "/Users/mac/Downloads/115 Murabe-A.--P07.pdf",
    linkedInvoice: "115wn0005",
  },
];
