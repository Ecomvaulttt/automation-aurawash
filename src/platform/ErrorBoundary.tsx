import { Component, ErrorInfo, ReactNode } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/button";

type State = { failed: boolean };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("EcomVault render error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="ev-auth-canvas">
        <section className="ev-auth-card" aria-labelledby="error-title">
          <div className="ev-auth-mark"><CircleAlert size={24} /></div>
          <p className="ev-auth-brand">EcomVault Finance</p>
          <h1 id="error-title">Werkruimte opnieuw laden</h1>
          <p className="ev-auth-copy">De interface kon niet veilig verdergaan. Je opgeslagen gegevens blijven behouden.</p>
          <Button variant="accent" onClick={() => window.location.reload()}><RotateCcw size={18} /> Opnieuw laden</Button>
        </section>
      </main>
    );
  }
}
