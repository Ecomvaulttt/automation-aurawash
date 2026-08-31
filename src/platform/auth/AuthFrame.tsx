import { Activity, Building2, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";
import { ReactNode } from "react";

export function AuthFrame({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <main className="ev-auth-canvas">
      <div className={compact ? "ev-auth-shell ev-auth-shell-compact" : "ev-auth-shell"}>
        <aside className="ev-auth-story" aria-label="EcomVault beveiliging">
          <div className="ev-auth-story-brand">
            <span><ShieldCheck size={21} /></span>
            <div>
              <strong>EcomVault</strong>
              <small>Finance OS</small>
            </div>
          </div>

          <div className="ev-auth-story-copy">
            <span className="ev-auth-story-label">Beveiligde bedrijfswerkruimte</span>
            <h2>Financiële controle zonder ruis.</h2>
            <p>
              Eén beveiligde werkruimte voor facturen, loonstroken, cashflow,
              deadlines en bedrijfsdocumenten.
            </p>
          </div>

          <div className="ev-auth-story-checks">
            <div>
              <span><LockKeyhole size={17} /></span>
              <p><strong>2FA verplicht</strong><small>Elke financiële sessie op AAL2</small></p>
            </div>
            <div>
              <span><Building2 size={17} /></span>
              <p><strong>Werkruimte-afscherming</strong><small>Alleen toegang tot toegewezen bedrijven</small></p>
            </div>
            <div>
              <span><FileCheck2 size={17} /></span>
              <p><strong>Controleerbare acties</strong><small>Belangrijke wijzigingen worden vastgelegd</small></p>
            </div>
          </div>

          <div className="ev-auth-story-status">
            <span><Activity size={15} /></span>
            Beveiligde toegang actief
          </div>
        </aside>

        <section className="ev-auth-stage">
          <header className="ev-auth-stage-brand">
            <span><ShieldCheck size={18} /></span>
            <strong>EcomVault Finance</strong>
          </header>
          {children}
          <footer className="ev-auth-footer">
            <span>EcomVault</span>
            <span>Beveiligde toegang</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
