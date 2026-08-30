import { FormEvent, useEffect, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useAuth } from "./AuthProvider";

export function MfaGate() {
  const auth = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.hasVerifiedTotp && !auth.enrollment) void auth.enrollTotp();
  }, [auth.enrollment, auth.hasVerifiedTotp]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return;
    setBusy(true);
    await auth.verifyTotp(code);
    setBusy(false);
  }

  return (
    <main className="ev-auth-canvas">
      <section className="ev-auth-card" aria-labelledby="mfa-title">
        <div className="ev-auth-mark"><ShieldCheck size={24} /></div>
        <p className="ev-auth-brand">EcomVault Finance</p>
        <h1 id="mfa-title">Beveilig je administratie</h1>
        <p className="ev-auth-copy">
          {auth.hasVerifiedTotp
            ? "Voer de zescijferige code uit je authenticator-app in."
            : "Scan de QR-code met je authenticator-app en bevestig daarna de zescijferige code."}
        </p>

        {auth.enrollment?.qrCode && (
          <div className="ev-mfa-setup">
            <img src={auth.enrollment.qrCode} alt="QR-code voor tweestapsverificatie" />
            <details>
              <summary>Handmatig instellen</summary>
              <code>{auth.enrollment.secret}</code>
            </details>
          </div>
        )}

        <form className="ev-auth-form" onSubmit={submit}>
          <label htmlFor="mfa-code">Beveiligingscode</label>
          <div className="ev-auth-input-wrap">
            <KeyRound size={18} />
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          {auth.error && <p className="ev-auth-error" role="alert">{auth.error}</p>}
          <Button variant="accent" type="submit" disabled={busy || code.length !== 6}>
            {busy ? <LoaderCircle className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            Bevestigen
          </Button>
        </form>
        <button className="ev-auth-link" type="button" onClick={() => void auth.signOut()}>Uitloggen</button>
      </section>
    </main>
  );
}
