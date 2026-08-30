import { FormEvent, ReactNode, useState } from "react";
import { KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useAuth } from "./AuthProvider";
import { MfaGate } from "./MfaGate";

export function SecurityWall({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  if (auth.mode === "demo") return <>{children}</>;
  if (auth.loading) {
    return <main className="ev-auth-canvas"><LoaderCircle className="animate-spin text-[#2D5BFF]" size={30} /></main>;
  }
  if (auth.session && auth.assuranceLevel !== "aal2") return <MfaGate />;
  if (auth.session) return <>{children}</>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    await auth.signIn(email, password);
    setBusy(false);
  }

  async function resetPassword() {
    if (!email) {
      setNotice("Vul eerst je e-mailadres in.");
      return;
    }
    setBusy(true);
    if (await auth.sendPasswordReset(email)) setNotice("Controleer je inbox voor de herstel-link.");
    setBusy(false);
  }

  return (
    <main className="ev-auth-canvas">
      <section className="ev-auth-card" aria-labelledby="login-title">
        <div className="ev-auth-mark"><LockKeyhole size={24} /></div>
        <p className="ev-auth-brand">EcomVault Finance</p>
        <h1 id="login-title">Welkom terug</h1>
        <p className="ev-auth-copy">Log veilig in bij de financiële werkruimte van je organisatie.</p>
        <div className="ev-auth-trust"><ShieldCheck size={15} /> Beschermd met organisatie-afscherming en 2FA</div>

        <form className="ev-auth-form" onSubmit={submit}>
          <label htmlFor="login-email">E-mailadres</label>
          <div className="ev-auth-input-wrap">
            <Mail size={18} />
            <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <label htmlFor="login-password">Wachtwoord</label>
          <div className="ev-auth-input-wrap">
            <KeyRound size={18} />
            <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {(auth.error || notice) && <p className={auth.error ? "ev-auth-error" : "ev-auth-notice"}>{auth.error || notice}</p>}
          <Button variant="accent" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" size={18} /> : <LockKeyhole size={18} />}
            Inloggen
          </Button>
        </form>
        <button className="ev-auth-link" type="button" onClick={() => void resetPassword()}>Wachtwoord vergeten</button>
      </section>
    </main>
  );
}
