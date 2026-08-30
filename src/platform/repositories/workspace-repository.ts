import { OnboardingState, Workspace } from "../types";

export interface WorkspaceRepository {
  listForCurrentUser(): Promise<Workspace[]>;
  getOnboarding(organizationId: string): Promise<OnboardingState>;
  saveOnboarding(
    organizationId: string,
    patch: Partial<OnboardingState>,
  ): Promise<OnboardingState>;
}
