import { FormEvent, ReactNode, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { AuthFrame } from "./AuthFrame";
import { useAuth } from "./AuthProvider";
import { MfaGate } from "./MfaGate";

type BusyAction = "email" | "google" | "reset" | null;

const demoLoginEmail = "info@ecomvault.nl";
const demoSessionKey = "ecomvault-demo-authenticated";

function getDemoLoginDigest() {
  return import.meta.env.VITE_DEMO_LOGIN_DIGEST?.trim() ?? "";
}

export async function hashDemoCredentials(email: string, password: string) {
  const value = `${email.trim().toLowerCase()}:${password}`;
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function SecurityWall({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const authPreview = auth.mode === "demo"
    ? new URLSearchParams(window.location.search).get("auth-preview")
    : null;
  const previewMode = authPreview === "login" || import.meta.env.VITE_REQUIRE_DEMO_LOGIN === "true";
  const [email, setEmail] = useState(previewMode ? demoLoginEmail : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notice, setNotice] = useState("");
  const [credentialError, setCredentialError] = useState("");
  const [demoAuthenticated, setDemoAuthenticated] = useState(() => {
    if (!previewMode) return false;
    try {
      return window.sessionStorage.getItem(demoSessionKey) === "true";
    } catch {
      return false;
    }
  });

  if (auth.mode === "demo" && authPreview === "mfa") return <MfaGate preview />;
  if (auth.mode === "demo" && !previewMode) return <>{children}</>;
  if (auth.mode === "demo" && demoAuthenticated) return <>{children}</>;
  if (auth.loading) {
    return (
      <AuthFrame compact>
        <section className="ev-auth-card ev-auth-loading" aria-label="Beveiligde werkruimte laden">
          <div className="ev-auth-mark"><LoaderCircle className="animate-spin" size={23} /></div>
          <h1>Werkruimte beveiligen</h1>
          <p className="ev-auth-copy">Je sessie en tweestapsverificatie worden gecontroleerd.</p>
        </section>
      </AuthFrame>
    );
  }
  if (auth.session && auth.assuranceLevel !== "aal2") return <MfaGate />;
  if (auth.session) return <>{children}</>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy("email");
    setNotice("");
    setCredentialError("");
    if (previewMode) {
      const digest = await hashDemoCredentials(email, password);
      const configuredDigest = getDemoLoginDigest();
      if (configuredDigest && email.trim().toLowerCase() === demoLoginEmail && digest === configuredDigest) {
        try {
          window.sessionStorage.setItem(demoSessionKey, "true");
        } catch {
          // The in-memory session still works when browser storage is unavailable.
        }
        setDemoAuthenticated(true);
      } else {
        setCredentialError("E-mailadres of wachtwoord klopt niet.");
      }
      setBusy(null);
      return;
    }
    const success = await auth.signIn(email, password);
    if (success) setNotice("Je account is gecontroleerd. De beveiligde werkruimte wordt geopend.");
    setBusy(null);
  }

  async function signInWithGoogle() {
    setBusy("google");
    setNotice("");
    setCredentialError("");
    const success = await auth.signInWithGoogle();
    if (success && previewMode) setNotice("Demo-preview: Google OAuth is klaar voor de productieconfiguratie.");
    setBusy(null);
  }

  async function resetPassword() {
    if (!email) {
      setNotice("Vul eerst je e-mailadres in om een herstel-link te ontvangen.");
      return;
    }
    setBusy("reset");
    setNotice("");
    if (await auth.sendPasswordReset(email)) setNotice("Controleer je inbox voor de beveiligde herstel-link.");
    setBusy(null);
  }

  const message = credentialError || auth.error || notice;
  const hasError = Boolean(credentialError || auth.error);

  return (
    <AuthFrame>
      <section className="ev-auth-card" aria-labelledby="login-title" aria-busy={Boolean(busy)}>
        <div className="ev-auth-card-head">
          <div className="ev-auth-mark"><LockKeyhole size={23} /></div>
          <div className="ev-auth-security-pill"><ShieldCheck size={14} /> 2FA verplicht</div>
        </div>

        <div className="ev-auth-heading">
          <p className="ev-auth-brand">Beveiligde bedrijfsomgeving</p>
          <h1 id="login-title">Welkom terug</h1>
          <p className="ev-auth-copy">Log in om de financiële werkruimte van je organisatie te openen.</p>
        </div>

        <button className="ev-google-button" type="button" aria-label="Doorgaan met Google" disabled={Boolean(busy)} onClick={() => void signInWithGoogle()}>
          {busy === "google" ? <LoaderCircle className="animate-spin" size={19} /> : <span className="ev-google-mark">G</span>}
          Doorgaan met Google
          <ArrowRight size={17} />
        </button>

        <div className="ev-auth-divider"><span>of met e-mail</span></div>

        <form className="ev-auth-form" onSubmit={submit}>
          <label htmlFor="login-email">Zakelijk e-mailadres</label>
          <div className="ev-auth-input-wrap">
            <Mail size={18} />
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="naam@bedrijf.nl"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="ev-auth-label-row">
            <label htmlFor="login-password">Wachtwoord</label>
            <button type="button" onClick={() => void resetPassword()} disabled={busy === "reset"}>
              {busy === "reset" ? "Versturen..." : "Wachtwoord vergeten?"}
            </button>
          </div>
          <div className="ev-auth-input-wrap">
            <KeyRound size={18} />
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Voer je wachtwoord in"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              className="ev-auth-password-toggle"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"}
              title={showPassword ? "Verbergen" : "Tonen"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {message && (
            <p className={hasError ? "ev-auth-error" : "ev-auth-notice"} role={hasError ? "alert" : "status"}>
              {hasError ? null : <CheckCircle2 size={15} />}
              {message}
            </p>
          )}

          <Button variant="accent" type="submit" disabled={Boolean(busy)}>
            {busy === "email" ? <LoaderCircle className="animate-spin" size={18} /> : <LockKeyhole size={18} />}
            Veilig inloggen
            {busy !== "email" && <ArrowRight size={17} />}
          </Button>
        </form>

        <div className="ev-auth-access-note">
          <ShieldCheck size={16} />
          <p><strong>Geen account?</strong><span>Vraag je beheerder om toegang tot de juiste werkruimte.</span></p>
        </div>
      </section>
    </AuthFrame>
  );
}
