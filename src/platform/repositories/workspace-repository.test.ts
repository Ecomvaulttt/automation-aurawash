import { beforeEach, describe, expect, it } from "vitest";
import { DemoWorkspaceRepository } from "./demo-workspace-repository";

describe("DemoWorkspaceRepository", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns a role-aware AuraWash workspace", async () => {
    const repository = new DemoWorkspaceRepository();
    const [workspace] = await repository.listForCurrentUser();

    expect(workspace).toMatchObject({
      organizationName: "AuraWash",
      locationName: "Hoofdvestiging",
      role: "owner",
    });
  });

  it("persists resumable onboarding state", async () => {
    const repository = new DemoWorkspaceRepository();
    const [workspace] = await repository.listForCurrentUser();

    await repository.saveOnboarding(workspace.organizationId, {
      currentStep: "email",
      completedSteps: ["company", "locations", "users", "security"],
    });

    await expect(repository.getOnboarding(workspace.organizationId)).resolves.toMatchObject({
      currentStep: "email",
      completedSteps: ["company", "locations", "users", "security"],
    });
  });
});
