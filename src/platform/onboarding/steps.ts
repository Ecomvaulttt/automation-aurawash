import { OnboardingStep } from "../types";

export const onboardingSteps: Array<{ id: OnboardingStep; label: string; detail: string; required: boolean }> = [
  { id: "company", label: "Bedrijf", detail: "Naam, logo en huisstijl", required: true },
  { id: "locations", label: "Vestigingen", detail: "Locaties en toegang", required: true },
  { id: "users", label: "Gebruikers", detail: "Accounts en rollen", required: true },
  { id: "security", label: "Beveiliging", detail: "2FA en herstel", required: true },
  { id: "email", label: "E-mail", detail: "Facturen en loonstroken", required: true },
  { id: "slack", label: "Slack", detail: "Deadline-meldingen", required: true },
  { id: "bank", label: "Bankimport", detail: "CSV/XLS controle", required: true },
  { id: "accountant", label: "Boekhouder", detail: "Export en toegang", required: true },
  { id: "rules", label: "Regels", detail: "Herinneringen en goedkeuring", required: true },
  { id: "launch", label: "Livegang", detail: "Eindcontrole", required: true },
];

export type LaunchSignals = {
  company: boolean;
  locations: boolean;
  users: boolean;
  security: boolean;
  email: boolean;
  slack: boolean;
  bank: boolean;
  accountant: boolean;
  rules: boolean;
};

export function evaluateOnboarding(signals: LaunchSignals) {
  const completed = (Object.entries(signals) as Array<[Exclude<OnboardingStep, "launch">, boolean]>)
    .filter(([, done]) => done)
    .map(([step]) => step);
  const blockers = onboardingSteps
    .filter((step) => step.id !== "launch" && step.required && !completed.includes(step.id))
    .map((step) => step.label);
  const launchReady = blockers.length === 0;
  return {
    completed: launchReady ? [...completed, "launch" as const] : completed,
    blockers,
    launchReady,
    score: Math.round(((completed.length + (launchReady ? 1 : 0)) / onboardingSteps.length) * 100),
  };
}
