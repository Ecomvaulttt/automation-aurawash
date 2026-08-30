import { OnboardingState, OnboardingStep, Workspace } from "../types";
import { WorkspaceRepository } from "./workspace-repository";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";
const STORAGE_KEY = "ecomvault:onboarding:v1";

const defaultOnboarding: OnboardingState = {
  organizationId: DEMO_ORGANIZATION_ID,
  currentStep: "company",
  completedSteps: [],
  status: "in_progress",
  data: {},
};

function isStep(value: unknown): value is OnboardingStep {
  return [
    "company",
    "locations",
    "users",
    "security",
    "email",
    "slack",
    "bank",
    "accountant",
    "rules",
    "launch",
  ].includes(String(value));
}

function readStoredState(): OnboardingState {
  if (typeof window === "undefined") return defaultOnboarding;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<OnboardingState> | null;
    if (!parsed || !isStep(parsed.currentStep)) return defaultOnboarding;

    return {
      ...defaultOnboarding,
      ...parsed,
      completedSteps: (parsed.completedSteps ?? []).filter(isStep),
      data: parsed.data && typeof parsed.data === "object" ? parsed.data : {},
    };
  } catch {
    return defaultOnboarding;
  }
}

export class DemoWorkspaceRepository implements WorkspaceRepository {
  async listForCurrentUser(): Promise<Workspace[]> {
    return [
      {
        organizationId: DEMO_ORGANIZATION_ID,
        organizationName: "AuraWash",
        organizationSlug: "aurawash-template",
        locationId: "00000000-0000-4000-8000-000000000102",
        locationName: "Hoofdvestiging",
        role: "owner",
      },
    ];
  }

  async getOnboarding(organizationId: string): Promise<OnboardingState> {
    return { ...readStoredState(), organizationId };
  }

  async saveOnboarding(
    organizationId: string,
    patch: Partial<OnboardingState>,
  ): Promise<OnboardingState> {
    const next = { ...readStoredState(), ...patch, organizationId };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }
}
