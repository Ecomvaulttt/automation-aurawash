import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "../../components/ui/button";
import { AuthFrame } from "./AuthFrame";
import { useAuth } from "./AuthProvider";

export function MfaGate({ preview = false }: { preview?: boolean }) {
  const auth = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const enrollmentMode = !preview && !auth.hasVerifiedTotp;

  useEffect(() => {
    if (!preview && !auth.hasVerifiedTotp && !auth.enrollment) void auth.enrollTotp();
  }, [auth.enrollment, auth.hasVerifiedTotp, preview]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return;
    setBusy(true);
    setNotice("");
    if (preview) {
      setNotice("Demo-preview: geldige 2FA opent in productie direct de toegewezen werkruimte.");
    } else {
      await auth.verifyTotp(code);
    }
    setBusy(false);
  }

  function leaveMfa() {
    if (preview) {
      window.location.assign(`${window.location.pathname}?auth-preview=login`);
      return;
    }
    void auth.signOut();
  }

  return (
    <AuthFrame compact={enrollmentMode}>
      <section className="ev-auth-card ev-mfa-card" aria-labelledby="mfa-title" aria-busy={busy}>
        <div className="ev-auth-card-head">
          <div className="ev-auth-mark"><ShieldCheck size={23} /></div>
          <div className="ev-auth-security-pill"><ShieldCheck size={14} /> Verplicht</div>
        </div>

        <div className="ev-auth-heading">
          <p className="ev-auth-brand">Tweestapsverificatie</p>
          <h1 id="mfa-title">{enrollmentMode ? "Beveilig je account" : "Bevestig dat jij het bent"}</h1>
          <p className="ev-auth-copy">
            {enrollmentMode
              ? "Koppel een authenticator-app. Zonder 2FA blijft financiële toegang geblokkeerd."
              : "Open je authenticator-app en voer de actuele zescijferige code in."}
          </p>
        </div>

        {enrollmentMode && (
          <div className="ev-mfa-enrollment">
            <div className="ev-mfa-steps" aria-label="2FA instellen">
              <div className="is-active"><span>1</span><p><strong>Scan QR-code</strong><small>Met Google Authenticator, Microsoft Authenticator of 1Password</small></p></div>
              <div><span>2</span><p><strong>Voer code in</strong><small>Bevestig de koppeling met de zescijferige code</small></p></div>
            </div>

            <div className="ev-mfa-setup">
              {auth.enrollment?.qrCode ? (
                <img src={auth.enrollment.qrCode} alt="QR-code voor tweestapsverificatie" />
              ) : (
                <div className="ev-mfa-qr-loading" aria-label="QR-code laden">
                  <LoaderCircle className="animate-spin" size={24} />
                </div>
              )}
              {auth.enrollment?.secret && (
                <details>
                  <summary>Kan je niet scannen?</summary>
                  <code>{auth.enrollment.secret}</code>
                </details>
              )}
            </div>
          </div>
        )}

        <form className="ev-auth-form ev-mfa-form" onSubmit={submit}>
          <label htmlFor="mfa-code">Beveiligingscode</label>
          <div className="ev-mfa-code">
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-label="Zescijferige beveiligingscode"
            />
            <div className="ev-mfa-code-slots" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className={index === Math.min(code.length, 5) ? "is-active" : ""}>
                  {code[index] ?? ""}
                </span>
              ))}
            </div>
          </div>

          {(auth.error || notice) && (
            <p className={auth.error ? "ev-auth-error" : "ev-auth-notice"} role={auth.error ? "alert" : "status"}>
              {auth.error ? null : <CheckCircle2 size={15} />}
              {auth.error || notice}
            </p>
          )}

          <Button variant="accent" type="submit" disabled={busy || code.length !== 6}>
            {busy ? <LoaderCircle className="animate-spin" size={18} /> : <KeyRound size={18} />}
            Code bevestigen
          </Button>
        </form>

        <div className="ev-mfa-session-note">
          <Smartphone size={17} />
          <p><strong>Nieuwe browser of apparaat?</strong><span>Dan vragen we opnieuw om je authenticatorcode.</span></p>
        </div>

        <button className="ev-auth-link" type="button" onClick={leaveMfa}>
          <ArrowLeft size={15} /> {preview ? "Terug naar login" : "Uitloggen en terug"}
        </button>
      </section>
    </AuthFrame>
  );
}
