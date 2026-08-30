import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { platformConfig } from "../config";
import { DemoWorkspaceRepository } from "../repositories/demo-workspace-repository";
import { SupabaseWorkspaceRepository } from "../repositories/supabase-workspace-repository";
import { WorkspaceRepository } from "../repositories/workspace-repository";
import { getSupabaseClient } from "../supabase";
import { Workspace } from "../types";
import { useAuth } from "../auth/AuthProvider";

type WorkspaceContextValue = {
  loading: boolean;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspace(organizationId: string, locationId: string | null): void;
  repository: WorkspaceRepository;
};

const demoFallback: Workspace = {
  organizationId: "00000000-0000-4000-8000-000000000101",
  organizationName: "AuraWash",
  organizationSlug: "aurawash-template",
  locationId: "00000000-0000-4000-8000-000000000102",
  locationName: "Hoofdvestiging",
  role: "owner",
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const repository = useMemo<WorkspaceRepository>(() => {
    const client = getSupabaseClient();
    return platformConfig.configured && client
      ? new SupabaseWorkspaceRepository(client)
      : new DemoWorkspaceRepository();
  }, []);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([demoFallback]);
  const [activeWorkspace, setWorkspace] = useState<Workspace>(demoFallback);
  const [loading, setLoading] = useState(platformConfig.configured);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (platformConfig.configured && !auth.user) return;
    let active = true;

    repository.listForCurrentUser().then((items) => {
      if (!active) return;
      if (platformConfig.configured && items.length === 0) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const available = items.length ? items : [demoFallback];
      const storedKey = window.localStorage.getItem("ecomvault:active-workspace:v1");
      const stored = available.find((item) => `${item.organizationId}:${item.locationId ?? "all"}` === storedKey);
      setWorkspaces(available);
      setWorkspace(stored ?? available[0]);
      setAccessDenied(false);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setAccessDenied(platformConfig.configured);
      setLoading(false);
    });

    return () => { active = false; };
  }, [auth.user, repository]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    loading,
    workspaces,
    activeWorkspace,
    repository,
    setActiveWorkspace(organizationId, locationId) {
      const next = workspaces.find(
        (item) => item.organizationId === organizationId && item.locationId === locationId,
      );
      if (!next) return;
      setWorkspace(next);
      window.localStorage.setItem(
        "ecomvault:active-workspace:v1",
        `${next.organizationId}:${next.locationId ?? "all"}`,
      );
    },
  }), [activeWorkspace, loading, repository, workspaces]);

  if (loading) {
    return <main className="ev-auth-canvas"><p className="ev-auth-copy">Werkruimte laden...</p></main>;
  }

  if (accessDenied) {
    return (
      <main className="ev-auth-canvas">
        <section className="ev-auth-card">
          <p className="ev-auth-brand">EcomVault Finance</p>
          <h1>Geen toegang</h1>
          <p className="ev-auth-copy">Je account is nog niet gekoppeld aan een organisatie. Vraag de eigenaar om je uitnodiging te controleren.</p>
          <button className="ev-auth-link" type="button" onClick={() => void auth.signOut()}>Uitloggen</button>
        </section>
      </main>
    );
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return value;
}
