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

export function SecurityWall({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const authPreview = auth.mode === "demo"
    ? new URLSearchParams(window.location.search).get("auth-preview")
    : null;
  const previewMode = authPreview === "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notice, setNotice] = useState("");

  if (auth.mode === "demo" && authPreview === "mfa") return <MfaGate preview />;
  if (auth.mode === "demo" && !previewMode) return <>{children}</>;
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
    const success = await auth.signIn(email, password);
    if (success && previewMode) setNotice("Demo-preview: de productie-login gaat hierna door naar verplichte 2FA.");
    setBusy(null);
  }

  async function signInWithGoogle() {
    setBusy("google");
    setNotice("");
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

  const message = auth.error || notice;

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
            <p className={auth.error ? "ev-auth-error" : "ev-auth-notice"} role={auth.error ? "alert" : "status"}>
              {auth.error ? null : <CheckCircle2 size={15} />}
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
