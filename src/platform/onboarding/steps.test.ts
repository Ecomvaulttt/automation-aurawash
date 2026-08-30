import { describe, expect, it } from "vitest";
import { evaluateOnboarding } from "./steps";

const ready = {
  company: true,
  locations: true,
  users: true,
  security: true,
  email: true,
  slack: true,
  bank: true,
  accountant: true,
  rules: true,
};

describe("evaluateOnboarding", () => {
  it("blocks livegang when a critical connector or bank mapping is missing", () => {
    const result = evaluateOnboarding({ ...ready, email: false, bank: false });
    expect(result.launchReady).toBe(false);
    expect(result.blockers).toEqual(["E-mail", "Bankimport"]);
    expect(result.completed).not.toContain("launch");
  });

  it("marks launch only when every required control is ready", () => {
    expect(evaluateOnboarding(ready)).toMatchObject({ launchReady: true, score: 100 });
  });
});
