import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  Cloud,
  KeyRound,
  Mail,
  MapPin,
  MessageSquare,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useAuth } from "../auth/AuthProvider";
import { AppRole, ConnectorStatus } from "../types";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { evaluateOnboarding, onboardingSteps as steps } from "../onboarding/steps";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: "active" | "invited" | "blocked";
};

type Location = { id: string; name: string; code: string; active: boolean };
type Connector = { id: string; label: string; detail: string; status: ConnectorStatus; icon: typeof Mail };

const defaultMembers: TeamMember[] = [
  { id: "member-owner", name: "Ramzi", email: "administratie@aurawash.nl", role: "owner", status: "active" },
  { id: "member-accountant", name: "Boekhouder", email: "boekhouder@voorbeeld.nl", role: "accountant", status: "invited" },
];

const defaultLocations: Location[] = [
  { id: "location-main", name: "Hoofdvestiging", code: "HQ", active: true },
];

const defaultConnectors: Connector[] = [
  { id: "google", label: "Google Workspace", detail: "Gmail inbox en bijlagen", status: "not_configured", icon: Mail },
  { id: "microsoft", label: "Microsoft 365", detail: "Outlook inbox en bijlagen", status: "not_configured", icon: Cloud },
  { id: "slack", label: "Slack", detail: "Acties en deadline-meldingen", status: "not_configured", icon: MessageSquare },
  { id: "bank", label: "Bankbestand", detail: "Veilige CSV/XLS import", status: "attention", icon: WalletCards },
];

function storedState<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function connectorTone(status: ConnectorStatus) {
  if (status === "connected") return "good" as const;
  if (status === "attention" || status === "expired") return "warn" as const;
  return "neutral" as const;
}

function connectorLabel(status: ConnectorStatus) {
  if (status === "connected") return "Verbonden";
  if (status === "attention") return "Actie nodig";
  if (status === "connecting") return "Bezig";
  if (status === "expired") return "Opnieuw verbinden";
  if (status === "disabled") return "Uitgeschakeld";
  return "Niet verbonden";
}

export function PlatformAdminCenter({ onOpenSetup }: { onOpenSetup: () => void }) {
  const auth = useAuth();
  const { activeWorkspace } = useWorkspace();
  const memberKey = `ecomvault:members:${activeWorkspace.organizationId}:v1`;
  const locationKey = `ecomvault:locations:${activeWorkspace.organizationId}:v1`;
  const connectorKey = `ecomvault:connectors:${activeWorkspace.organizationId}:v1`;
  const [members, setMembers] = useState<TeamMember[]>(() => storedState(memberKey, defaultMembers));
  const [locations, setLocations] = useState<Location[]>(() => storedState(locationKey, defaultLocations));
  const [connectors, setConnectors] = useState<Connector[]>(() => {
    const stored = storedState<Array<Pick<Connector, "id" | "status">>>(connectorKey, []);
    return defaultConnectors.map((connector) => ({
      ...connector,
      status: stored.find((item) => item.id === connector.id)?.status ?? connector.status,
    }));
  });
  const [invite, setInvite] = useState({ name: "", email: "", role: "employee" as AppRole });
  const [locationName, setLocationName] = useState("");
  const [busy, setBusy] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState("");
  const [connectorFeedback, setConnectorFeedback] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<TeamMember | null>(null);
  const [removalReason, setRemovalReason] = useState("");

  const securityReady = auth.mode === "demo" || auth.assuranceLevel === "aal2";
  const connectedCount = connectors.filter((connector) => connector.status === "connected").length;
  const onboarding = evaluateOnboarding({
    company: Boolean(activeWorkspace.organizationName),
    locations: locations.some((location) => location.active),
    users: members.some((member) => member.role === "owner" && member.status === "active"),
    security: securityReady,
    email: connectors.some((connector) => ["google", "microsoft"].includes(connector.id) && connector.status === "connected"),
    slack: connectors.some((connector) => connector.id === "slack" && connector.status === "connected"),
    bank: connectors.some((connector) => connector.id === "bank" && connector.status === "connected"),
    accountant: members.some((member) => member.role === "accountant" && member.status !== "blocked"),
    rules: true,
  });
  const completedSteps = onboarding.completed;
  const setupScore = onboarding.score;
  const nextStep = steps.find((step) => !completedSteps.includes(step.id)) ?? steps.at(-1)!;

  const health = useMemo(() => [
    { label: "2FA", value: securityReady ? "Actief" : "Actie nodig", good: securityReady },
    { label: "Accounts", value: `${members.filter((member) => member.status === "active").length} actief`, good: true },
    { label: "Koppelingen", value: `${connectedCount}/${connectors.length}`, good: connectedCount >= 2 },
    { label: "Vestigingen", value: String(locations.filter((location) => location.active).length), good: locations.some((location) => location.active) },
  ], [connectedCount, connectors.length, locations, members, securityReady]);

  useEffect(() => {
    if (auth.mode !== "production" || !auth.session) return;
    void loadMembers();
    void loadConnectors();
  }, [activeWorkspace.organizationId, auth.mode, auth.session?.access_token]);

  async function loadMembers() {
    if (!auth.session) return;
    setBusy(true);
    const response = await fetch(`/api/admin/users?organizationId=${encodeURIComponent(activeWorkspace.organizationId)}`, {
      headers: { Authorization: `Bearer ${auth.session.access_token}` },
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && Array.isArray(payload?.members)) {
      setMembers(payload.members.map((member: Record<string, unknown>) => {
        const profileValue = member.profiles;
        const profile = Array.isArray(profileValue) ? profileValue[0] : profileValue;
        const safeProfile = profile && typeof profile === "object" ? profile as Record<string, unknown> : {};
        return {
          id: String(member.id),
          name: String(safeProfile.full_name || "Gebruiker"),
          email: String(safeProfile.email || ""),
          role: member.role as AppRole,
          status: member.status as TeamMember["status"],
        };
      }));
      setAccountFeedback("");
    } else {
      setAccountFeedback("Accounts konden niet worden geladen.");
    }
    setBusy(false);
  }

  async function loadConnectors() {
    if (!auth.session) return;
    const response = await fetch(`/api/integrations/status?organizationId=${encodeURIComponent(activeWorkspace.organizationId)}`, {
      headers: { Authorization: `Bearer ${auth.session.access_token}` },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload?.integrations)) return;
    setConnectors((current) => current.map((connector) => {
      const live = payload.integrations.find((item: Record<string, unknown>) => item.provider === connector.id);
      return live ? { ...connector, status: live.status as ConnectorStatus } : connector;
    }));
  }

  function persist<T>(key: string, value: T) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!invite.name.trim() || !invite.email.includes("@")) return;
    if (auth.mode === "production" && auth.session) {
      setBusy(true);
      setAccountFeedback("");
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` },
        body: JSON.stringify({ organizationId: activeWorkspace.organizationId, locationId: activeWorkspace.locationId, ...invite }),
      });
      if (response.ok) {
        setInvite({ name: "", email: "", role: "employee" });
        setAccountFeedback("Uitnodiging is veilig verstuurd.");
        await loadMembers();
      } else {
        setAccountFeedback("Uitnodigen lukte niet. Controleer 2FA, e-mailadres en rechten.");
      }
      setBusy(false);
      return;
    }
    const next = [...members, { id: crypto.randomUUID(), ...invite, status: "invited" as const }];
    setMembers(next);
    persist(memberKey, next);
    setInvite({ name: "", email: "", role: "employee" });
  }

  function requestRemoveMember(member: TeamMember) {
    if (member.role === "owner") return;
    if (auth.mode === "production") {
      setPendingRemoval(member);
      setRemovalReason("");
      return;
    }
    removeMember(member.id);
  }

  function removeMember(id: string) {
    const next = members.filter((member) => member.id !== id || member.role === "owner");
    setMembers(next);
    persist(memberKey, next);
  }

  async function confirmRemoveMember() {
    if (!pendingRemoval || !auth.session || removalReason.trim().length < 5) return;
    setBusy(true);
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` },
      body: JSON.stringify({
        organizationId: activeWorkspace.organizationId,
        membershipId: pendingRemoval.id,
        reason: removalReason,
      }),
    });
    if (response.ok) {
      setPendingRemoval(null);
      setRemovalReason("");
      setAccountFeedback("Toegang is ingetrokken en vastgelegd in de auditlog.");
      await loadMembers();
    } else {
      setAccountFeedback("Toegang kon niet worden ingetrokken.");
    }
    setBusy(false);
  }

  async function updateMember(member: TeamMember, patch: Partial<Pick<TeamMember, "role" | "status">>) {
    const nextMember = { ...member, ...patch };
    if (auth.mode === "demo") {
      const next = members.map((item) => item.id === member.id ? nextMember : item);
      setMembers(next);
      persist(memberKey, next);
      return;
    }
    if (!auth.session) return;
    setBusy(true);
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` },
      body: JSON.stringify({
        organizationId: activeWorkspace.organizationId,
        membershipId: member.id,
        role: nextMember.role,
        status: nextMember.status,
      }),
    });
    if (response.ok) await loadMembers();
    else setAccountFeedback("De rol of status kon niet worden aangepast.");
    setBusy(false);
  }

  function addLocation(event: FormEvent) {
    event.preventDefault();
    if (!locationName.trim()) return;
    const code = locationName.trim().slice(0, 3).toUpperCase();
    const next = [...locations, { id: crypto.randomUUID(), name: locationName.trim(), code, active: true }];
    setLocations(next);
    persist(locationKey, next);
    setLocationName("");
  }

  function removeLocation(id: string) {
    if (locations.length <= 1) return;
    const next = locations.filter((location) => location.id !== id);
    setLocations(next);
    persist(locationKey, next);
  }

  async function toggleConnector(id: string) {
    if (auth.mode === "production") {
      if (id === "bank") {
        onOpenSetup();
        return;
      }
      if (!auth.session) return;
      setBusy(true);
      setConnectorFeedback("");
      const response = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` },
        body: JSON.stringify({
          organizationId: activeWorkspace.organizationId,
          locationId: activeWorkspace.locationId,
          provider: id,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.authorizationUrl) {
        window.location.assign(payload.authorizationUrl);
      } else {
        setConnectorFeedback("Deze koppeling is nog niet door EcomVault geconfigureerd.");
        setBusy(false);
      }
      return;
    }
    const next = connectors.map((connector) => connector.id === id
      ? { ...connector, status: connector.status === "connected" ? "not_configured" as const : "connected" as const }
      : connector);
    setConnectors(next);
    persist(connectorKey, next.map(({ id: connectorId, status }) => ({ id: connectorId, status })));
  }

  return (
    <section className="ev-admin-grid">
      <Card className="ev-admin-hero">
        <div>
          <div className="ev-admin-kicker"><ShieldCheck size={16} /> Platformbeheer</div>
          <h2>{activeWorkspace.organizationName} klaarzetten voor dagelijks gebruik</h2>
          <p>Beheer vestigingen, accounts, beveiliging en koppelingen vanuit één gecontroleerde werkruimte.</p>
        </div>
        <div className="ev-admin-score" aria-label={`${setupScore} procent ingericht`}>
          <strong>{setupScore}%</strong>
          <span>inrichting compleet</span>
          <div><i style={{ width: `${setupScore}%` }} /></div>
        </div>
      </Card>

      <div className="ev-admin-health">
        {health.map((item) => (
          <div key={item.label} className="ev-admin-health-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <i className={item.good ? "is-good" : "is-warn"} />
          </div>
        ))}
      </div>

      <Card className="ev-admin-section ev-admin-setup">
        <div className="ev-admin-section-head">
          <div><span>Plug-and-play installatie</span><h3>Startcheck</h3></div>
          <Badge tone={setupScore === 100 ? "good" : "accent"}>{setupScore}% gereed</Badge>
        </div>
        <div className="ev-setup-list">
          {steps.map((step, index) => {
            const done = completedSteps.includes(step.id);
            const current = nextStep.id === step.id;
            return (
              <div key={step.id} className={current ? "is-current" : ""}>
                <span className={done ? "is-done" : ""}>{done ? <Check size={15} /> : index + 1}</span>
                <div><strong>{step.label}</strong><small>{step.detail}</small></div>
                <ChevronRight size={17} />
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="ev-admin-section">
        <div className="ev-admin-section-head">
          <div><span>Organisatie</span><h3>Vestigingen</h3></div>
          <MapPin size={19} />
        </div>
        <div className="ev-admin-rows">
          {locations.map((location) => (
            <div className="ev-admin-row" key={location.id}>
              <span className="ev-admin-row-icon"><Building2 size={18} /></span>
              <div><strong>{location.name}</strong><small>{location.code} · {location.active ? "Actief" : "Inactief"}</small></div>
              <Button variant="ghost" size="icon" aria-label={`${location.name} verwijderen`} disabled={locations.length <= 1} onClick={() => removeLocation(location.id)}><Trash2 size={17} /></Button>
            </div>
          ))}
        </div>
        <form className="ev-admin-inline-form" onSubmit={addLocation}>
          <Input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Nieuwe vestiging" />
          <Button variant="secondary" type="submit"><Plus size={17} /> Toevoegen</Button>
        </form>
      </Card>

      <Card className="ev-admin-section ev-admin-wide">
        <div className="ev-admin-section-head">
          <div><span>Toegang</span><h3>Accounts en rollen</h3></div>
          <Users size={19} />
        </div>
        <div className="ev-admin-member-table">
          {members.map((member) => (
            <div className="ev-admin-member" key={member.id}>
              <span className="ev-admin-avatar">{member.name.slice(0, 1).toUpperCase()}</span>
              <div><strong>{member.name}</strong><small>{member.email}</small></div>
              <Select aria-label={`Status van ${member.name}`} value={member.status} disabled={member.role === "owner" || busy} onChange={(event) => void updateMember(member, { status: event.target.value as TeamMember["status"] })}>
                <option value="invited">Uitgenodigd</option>
                <option value="active">Actief</option>
                <option value="blocked">Geblokkeerd</option>
              </Select>
              <Select aria-label={`Rol van ${member.name}`} value={member.role} disabled={member.role === "owner" || busy} onChange={(event) => void updateMember(member, { role: event.target.value as AppRole })}>
                <option value="owner">Eigenaar</option>
                <option value="manager">Manager</option>
                <option value="accountant">Boekhouder</option>
                <option value="employee">Medewerker</option>
              </Select>
              <Button variant="ghost" size="icon" aria-label={`${member.name} verwijderen`} disabled={member.role === "owner" || busy} onClick={() => requestRemoveMember(member)}><Trash2 size={17} /></Button>
            </div>
          ))}
        </div>
        <form className="ev-admin-invite-form" onSubmit={addMember}>
          <Input value={invite.name} onChange={(event) => setInvite({ ...invite, name: event.target.value })} placeholder="Naam" />
          <Input type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} placeholder="naam@bedrijf.nl" />
          <Select value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value as AppRole })}>
            <option value="manager">Manager</option>
            <option value="accountant">Boekhouder</option>
            <option value="employee">Medewerker</option>
          </Select>
          <Button variant="accent" type="submit" disabled={busy}><UserPlus size={17} /> Uitnodigen</Button>
        </form>
        {accountFeedback && <p className="ev-admin-feedback" role="status">{accountFeedback}</p>}
      </Card>

      <Card className="ev-admin-section ev-admin-wide">
        <div className="ev-admin-section-head">
          <div><span>Automatisering</span><h3>Koppelingen</h3></div>
          <Badge tone={connectedCount ? "good" : "warn"}>{connectedCount} verbonden</Badge>
        </div>
        <div className="ev-connector-grid">
          {connectors.map((connector) => {
            const Icon = connector.icon;
            return (
              <div className="ev-connector" key={connector.id}>
                <span className="ev-connector-icon"><Icon size={20} /></span>
                <div><strong>{connector.label}</strong><small>{connector.detail}</small></div>
                <Badge tone={connectorTone(connector.status)}>{connectorLabel(connector.status)}</Badge>
                <Button variant={connector.status === "connected" ? "ghost" : "secondary"} size="sm" disabled={busy} onClick={() => void toggleConnector(connector.id)}>
                  {connector.id === "bank" && auth.mode === "production"
                    ? "Bankbestand uploaden"
                    : connector.status === "connected" && auth.mode === "production"
                      ? "Opnieuw verbinden"
                      : connector.status === "connected"
                        ? "Ontkoppelen"
                        : "Verbinden"}
                </Button>
              </div>
            );
          })}
        </div>
        {auth.mode === "demo" && (
          <p className="ev-admin-demo-note"><CircleAlert size={15} /> Demo: knoppen simuleren de verbindingsstatus. Na Supabase-activatie starten ze de veilige OAuth-flow.</p>
        )}
        {connectorFeedback && <p className="ev-admin-feedback" role="status">{connectorFeedback}</p>}
      </Card>

      <Card className="ev-admin-section">
        <div className="ev-admin-section-head">
          <div><span>Security</span><h3>Toegangscontrole</h3></div>
          <KeyRound size={19} />
        </div>
        <div className="ev-security-summary">
          <span className={securityReady ? "is-ready" : ""}><ShieldCheck size={21} /></span>
          <div><strong>{securityReady ? "Beveiligingsniveau op orde" : "2FA moet worden afgerond"}</strong><small>Financiële mutaties vereisen altijd een tweede factor.</small></div>
        </div>
        <ul className="ev-admin-checks">
          <li><Check size={15} /> Tenant-afscherming actief</li>
          <li><Check size={15} /> Rollen centraal beheerd</li>
          <li><Check size={15} /> Auditlog voorbereid</li>
          <li><Check size={15} /> Documenten privé opgeslagen</li>
        </ul>
      </Card>

      {pendingRemoval && (
        <div className="ev-admin-modal-layer" role="presentation">
          <section className="ev-admin-modal" role="dialog" aria-modal="true" aria-labelledby="remove-user-title">
            <div className="ev-admin-modal-icon"><CircleAlert size={21} /></div>
            <h3 id="remove-user-title">Toegang van {pendingRemoval.name} intrekken?</h3>
            <p>Dit blokkeert het account voor deze organisatie. De financiële historie blijft intact.</p>
            <label htmlFor="removal-reason">Reden</label>
            <Input id="removal-reason" autoFocus value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} placeholder="Bijvoorbeeld: uit dienst per 31 augustus" />
            <div className="ev-admin-modal-actions">
              <Button variant="secondary" onClick={() => setPendingRemoval(null)}>Annuleren</Button>
              <Button variant="danger" disabled={busy || removalReason.trim().length < 5} onClick={() => void confirmRemoveMember()}><Trash2 size={17} /> Toegang intrekken</Button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
