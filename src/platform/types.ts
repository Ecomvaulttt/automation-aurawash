export type AppRole =
  | "ecomvault_superadmin"
  | "owner"
  | "manager"
  | "accountant"
  | "employee";

export type Workspace = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  locationId: string | null;
  locationName: string | null;
  role: AppRole;
};

export type OnboardingStep =
  | "company"
  | "locations"
  | "users"
  | "security"
  | "email"
  | "slack"
  | "bank"
  | "accountant"
  | "rules"
  | "launch";

export type OnboardingState = {
  organizationId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  status: "in_progress" | "ready" | "launched";
  data: Record<string, unknown>;
};

export type ConnectorStatus =
  | "not_configured"
  | "connecting"
  | "connected"
  | "attention"
  | "expired"
  | "disabled";
