import { SupabaseClient } from "@supabase/supabase-js";
import { AppRole, OnboardingState, OnboardingStep, Workspace } from "../types";
import { WorkspaceRepository } from "./workspace-repository";

type MembershipRow = {
  organization_id: string;
  location_id: string | null;
  role: AppRole;
};

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listForCurrentUser(): Promise<Workspace[]> {
    const { data, error } = await this.client
      .from("memberships")
      .select("organization_id, location_id, role")
      .eq("status", "active")
      .is("deleted_at", null);

    if (error) throw error;

    const memberships = (data ?? []) as unknown as MembershipRow[];
    if (!memberships.length) return [];
    const organizationIds = Array.from(new Set(memberships.map((item) => item.organization_id)));
    const [{ data: organizations, error: organizationError }, { data: locations, error: locationError }] = await Promise.all([
      this.client.from("organizations").select("id, name, slug").in("id", organizationIds),
      this.client.from("locations").select("id, organization_id, name").in("organization_id", organizationIds).eq("active", true).is("deleted_at", null),
    ]);
    if (organizationError || locationError) throw organizationError ?? locationError;
    const organizationById = new Map((organizations ?? []).map((item) => [item.id, item]));
    const locationById = new Map((locations ?? []).map((item) => [item.id, item]));

    return memberships.flatMap((membership) => {
      const organization = organizationById.get(membership.organization_id);
      const location = membership.location_id ? locationById.get(membership.location_id) : null;

      const base = {
        organizationId: membership.organization_id,
        organizationName: organization?.name ?? "Organisatie",
        organizationSlug: organization?.slug ?? membership.organization_id,
        locationId: membership.location_id,
        locationName: location?.name ?? null,
        role: membership.role,
      };
      if (membership.location_id || !["owner", "ecomvault_superadmin"].includes(membership.role)) return [base];
      const organizationLocations = (locations ?? []).filter((item) => item.organization_id === membership.organization_id);
      return [base, ...organizationLocations.map((item) => ({ ...base, locationId: item.id, locationName: item.name }))];
    });
  }

  async getOnboarding(organizationId: string): Promise<OnboardingState> {
    const { data, error } = await this.client
      .from("onboarding_progress")
      .select("organization_id, current_step, completed_steps, status, data")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;

    return {
      organizationId,
      currentStep: (data?.current_step ?? "company") as OnboardingStep,
      completedSteps: (data?.completed_steps ?? []) as OnboardingStep[],
      status: (data?.status ?? "in_progress") as OnboardingState["status"],
      data: (data?.data ?? {}) as Record<string, unknown>,
    };
  }

  async saveOnboarding(
    organizationId: string,
    patch: Partial<OnboardingState>,
  ): Promise<OnboardingState> {
    const current = await this.getOnboarding(organizationId);
    const next = { ...current, ...patch, organizationId };
    const { data, error } = await this.client
      .from("onboarding_progress")
      .upsert(
        {
          organization_id: organizationId,
          current_step: next.currentStep,
          completed_steps: next.completedSteps,
          status: next.status,
          data: next.data,
        },
        { onConflict: "organization_id" },
      )
      .select("organization_id, current_step, completed_steps, status, data")
      .single();

    if (error) throw error;

    return {
      organizationId: data.organization_id,
      currentStep: data.current_step as OnboardingStep,
      completedSteps: data.completed_steps as OnboardingStep[],
      status: data.status as OnboardingState["status"],
      data: data.data as Record<string, unknown>,
    };
  }
}
