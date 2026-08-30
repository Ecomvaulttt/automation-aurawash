import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyDocument,
  extractInvoiceNumber,
  isAllowedSlackWebhook,
  normalizeReminderSettings,
  reminderIsDue,
  sanitizeMailHeader,
  sendProviderMail,
} from "./platform-automation.mjs";

afterEach(() => vi.unstubAllGlobals());

describe("platform automation classification", () => {
  it("recognizes payroll and invoice types", () => {
    expect(classifyDocument("Loonstrook augustus", "murabe.pdf")).toBe("loonstrook");
    expect(classifyDocument("Verkoopfactuur VF260041", "VF260041.pdf")).toBe("te-ontvangen");
    expect(classifyDocument("Factuur", "INV-802.pdf")).toBe("te-betalen");
  });

  it("extracts the invoice number", () => {
    expect(extractInvoiceNumber("Factuur VF260041", "document.pdf")).toBe("VF260041");
    expect(extractInvoiceNumber("Inkoop INV-802", "document.pdf")).toBe("INV-802");
  });

  it("keeps reminder settings within safe platform limits", () => {
    expect(normalizeReminderSettings({ payable_reminder_days: 99, receivable_reminder_days: -5, auto_customer_email: "yes" })).toEqual({
      payable_reminder_days: 30,
      receivable_reminder_days: 0,
      auto_customer_email: false,
    });
  });

  it("triggers the correct 5/3 day window and skips paid invoices", () => {
    const now = Date.UTC(2026, 7, 30);
    const settings = { payable_reminder_days: 5, receivable_reminder_days: 3 };
    expect(reminderIsDue({ direction: "payable", due_date: "2026-09-04", paid: "no" }, settings, now)).toBe(true);
    expect(reminderIsDue({ direction: "receivable", due_date: "2026-09-02", paid: "no" }, settings, now)).toBe(true);
    expect(reminderIsDue({ direction: "receivable", due_date: "2026-09-03", paid: "no" }, settings, now)).toBe(false);
    expect(reminderIsDue({ direction: "payable", due_date: "2026-09-01", paid: "yes" }, settings, now)).toBe(false);
  });

  it("allows only official HTTPS Slack webhook hosts", () => {
    expect(isAllowedSlackWebhook("https://hooks.slack.com/services/T/B/X")).toBe(true);
    expect(isAllowedSlackWebhook("http://hooks.slack.com/services/T/B/X")).toBe(false);
    expect(isAllowedSlackWebhook("https://hooks.slack.com.attacker.example/services/T/B/X")).toBe(false);
  });

  it("removes header injection from provider email", async () => {
    let requestBody = "";
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requestBody = String(init?.body ?? "");
      return new Response("{}", { status: 200 });
    }));
    await sendProviderMail("google", { access_token: "test" }, "finance@example.com", "Factuur\r\nBcc: attacker@example.com", "Bericht");
    const raw = Buffer.from(JSON.parse(requestBody).raw, "base64url").toString("utf8");
    expect(raw).not.toContain("\r\nBcc:");
    expect(sanitizeMailHeader("Factuur\r\nBcc: test")).toBe("Factuur Bcc: test");
  });

  it("rejects unknown email providers before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendProviderMail("unknown", { access_token: "test" }, "finance@example.com", "Factuur", "Bericht")).rejects.toThrow("unsupported_email_provider");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
