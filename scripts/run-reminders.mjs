import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const documentsPath = resolve(root, "automation/inbox-documents.json");
const logPath = resolve(root, "automation/reminder-log.json");
const today = new Date().toISOString().slice(0, 10);

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(value) {
  const date = parseDate(value);
  if (!date) return null;
  const start = new Date(`${today}T00:00:00`);
  return Math.ceil((date.getTime() - start.getTime()) / 86_400_000);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function euro(value) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function makeSlackText(document, daysLeft) {
  const timing = daysLeft < 0 ? `${Math.abs(daysLeft)} dagen te laat` : `${daysLeft} dagen resterend`;
  const action =
    document.type === "te-ontvangen"
      ? "Klant opvolgen en automatische e-mail sturen als betaling ontbreekt."
      : "Intern betalen/controleren voor deadline.";
  return [
    `*AuraWash factuur reminder*`,
    `Type: ${document.type}`,
    `Relatie: ${document.relation}`,
    `Factuur: ${document.invoiceNumber}`,
    `Bedrag: ${euro(document.amount)}`,
    `Deadline: ${document.dueDate || "onbekend"} (${timing})`,
    `Actie: ${action}`,
  ].join("\n");
}

function makeCustomerMail(document) {
  return {
    subject: `Herinnering factuur ${document.invoiceNumber}`,
    text: `Hi,\n\nWe zien dat factuur ${document.invoiceNumber} van ${euro(document.amount)} nog niet als betaald staat. Wil je deze uiterlijk ${document.dueDate} overboeken?\n\nAls de betaling al gedaan is, mag je dit bericht negeren of een betaalbewijs terugsturen.\n\nGroet,\nAuraWash`,
  };
}

async function sendSlack(text) {
  if (!process.env.SLACK_WEBHOOK_URL) return false;
  const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`Slack webhook failed: ${response.status} ${await response.text()}`);
  return true;
}

function createTransporter() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  if (required.some((key) => !process.env[key])) return null;
  const port = Number(process.env.SMTP_PORT);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function main() {
  const documents = await readJson(documentsPath, []);
  const log = await readJson(logPath, []);
  const logged = new Set(log.map((item) => item.key));
  const payableDays = Number(process.env.PAYABLE_REMINDER_DAYS || 5);
  const receivableDays = Number(process.env.RECEIVABLE_REMINDER_DAYS || 3);
  const autoCustomerEmail = process.env.AUTO_SEND_CUSTOMER_EMAILS === "true";
  const transporter = createTransporter();
  const newLog = [];

  for (const document of documents) {
    if (document.paid !== "NEE") continue;
    if (!["te-betalen", "te-ontvangen", "vaste-last"].includes(document.type)) continue;

    const daysLeft = daysUntil(document.dueDate);
    if (daysLeft === null) continue;
    const threshold = document.type === "te-ontvangen" ? receivableDays : payableDays;
    if (daysLeft > threshold) continue;

    const slackKey = `${today}:slack:${document.id}:${document.dueDate}`;
    if (!logged.has(slackKey)) {
      const sent = await sendSlack(makeSlackText(document, daysLeft));
      newLog.push({ key: slackKey, at: new Date().toISOString(), channel: "slack", sent });
    }

    const customerEmail = document.customerEmail || document.senderEmail;
    const shouldEmailCustomer = document.type === "te-ontvangen" && autoCustomerEmail && customerEmail && transporter;
    const mailKey = `${today}:mail:${document.id}:${document.dueDate}:${customerEmail}`;
    if (shouldEmailCustomer && !logged.has(mailKey)) {
      const mail = makeCustomerMail(document);
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: customerEmail,
        replyTo: process.env.EMAIL_REPLY_TO || process.env.SMTP_FROM,
        subject: mail.subject,
        text: mail.text,
      });
      newLog.push({ key: mailKey, at: new Date().toISOString(), channel: "email", to: customerEmail, sent: true });
    }
  }

  await mkdir(dirname(logPath), { recursive: true });
  await writeFile(logPath, `${JSON.stringify([...newLog, ...log], null, 2)}\n`);
  console.log(`Reminder run complete. New notifications: ${newLog.length}.`);
}

await main();
