import { afterEach, describe, expect, it } from "vitest";
import auditHandler from "./admin/audit.mjs";
import launchHandler from "./admin/launch.mjs";
import locationsHandler from "./admin/locations.mjs";
import automationHandler, { secretMatches } from "./automation/run.mjs";
import emailHandler from "./email/send.mjs";
import healthHandler from "./health.mjs";

type TestResponse = {
  statusCode: number;
  payload?: Record<string, unknown>;
  headers: Record<string, string>;
  setHeader(name: string, value: string): void;
  status(code: number): TestResponse;
  json(payload: Record<string, unknown>): TestResponse;
};

function response(): TestResponse {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

const requiredEnvironment = ["VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TOKEN_ENCRYPTION_KEY", "CRON_SECRET"];
const originalEnvironment = Object.fromEntries(requiredEnvironment.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of requiredEnvironment) {
    if (originalEnvironment[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnvironment[name];
  }
});

describe("API security boundaries", () => {
  it("compares cron credentials without plain string equality", () => {
    expect(secretMatches("correct-secret", "correct-secret")).toBe(true);
    expect(secretMatches("wrong", "correct-secret")).toBe(false);
    expect(secretMatches("", "correct-secret")).toBe(false);
  });

  it("rejects an automation run before database access when the cron secret is wrong", async () => {
    process.env.CRON_SECRET = "expected-secret";
    const result = response();
    await automationHandler({ method: "POST", headers: { authorization: "Bearer wrong-secret" } }, result);
    expect(result.statusCode).toBe(401);
    expect(result.payload).toEqual({ ok: false, error: "invalid_cron_secret" });
  });

  it("rejects malformed email and tenant identifiers before authorization", async () => {
    const result = response();
    await emailHandler({ method: "POST", body: { organizationId: "------------------------------------", to: "x@example.com", subject: "Factuur", body: "Test" } }, result);
    expect(result.statusCode).toBe(400);
    expect(result.payload?.error).toBe("invalid_email");
  });

  it("rejects malformed location requests before touching tenant data", async () => {
    const result = response();
    await locationsHandler({ method: "POST", body: { organizationId: "invalid", name: "Vestiging", code: "VST" } }, result);
    expect(result.statusCode).toBe(400);
  });

  it("blocks launch checks for malformed tenant identifiers", async () => {
    const result = response();
    await launchHandler({ method: "POST", body: { organizationId: "invalid" } }, result);
    expect(result.statusCode).toBe(400);
  });

  it("keeps the audit endpoint read-only", async () => {
    const result = response();
    await auditHandler({ method: "POST", query: {} }, result);
    expect(result.statusCode).toBe(405);
    expect(result.headers["Cache-Control"]).toBe("no-store");
  });

  it("reports incomplete health without naming or leaking missing secrets", async () => {
    for (const name of requiredEnvironment) delete process.env[name];
    const result = response();
    await healthHandler({ method: "GET" }, result);
    expect(result.statusCode).toBe(503);
    expect(result.payload).toEqual({ ok: false, status: "configuration_incomplete" });
    expect(JSON.stringify(result.payload)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
