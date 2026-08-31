import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

export type ProductTourStep = {
  selector: string;
  title: string;
  description: string;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type ProductTourProps = {
  open: boolean;
  steps: ProductTourStep[];
  stepIndex: number;
  onStepChange: (index: number) => void;
  onSkip: () => void;
  onFinish: () => void;
};

const PANEL_HEIGHT_ESTIMATE = 270;

export function ProductTour({
  open,
  steps,
  stepIndex,
  onStepChange,
  onSkip,
  onFinish,
}: ProductTourProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!open || !step) return;

    let cancelled = false;
    let retryTimer = 0;

    const measure = (attempt = 0) => {
      if (cancelled) return;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(step.selector));
      const target = candidates.find((candidate) => {
        const candidateRect = candidate.getBoundingClientRect();
        return candidateRect.width > 0 && candidateRect.height > 0;
      }) ?? candidates[0];

      if (!target) {
        setTargetRect(null);
        if (attempt < 12) retryTimer = window.setTimeout(() => measure(attempt + 1), 60);
        return;
      }

      const rect = target.getBoundingClientRect();
      const outsideViewport = rect.bottom < 12 || rect.top > window.innerHeight - 12;
      if (outsideViewport && attempt === 0 && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        retryTimer = window.setTimeout(() => measure(1), 320);
        return;
      }

      setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };

    measure();
    const handleViewportChange = () => measure(1);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
      if (event.key === "ArrowRight" && stepIndex < steps.length - 1) onStepChange(stepIndex + 1);
      if (event.key === "ArrowLeft" && stepIndex > 0) onStepChange(stepIndex - 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSkip, onStepChange, open, stepIndex, steps.length]);

  const panelStyle = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(380, viewportWidth - 24);

    if (!targetRect) {
      return { left: 12, bottom: 12, width };
    }

    if (viewportWidth < 640) {
      const targetBottom = targetRect.top + targetRect.height;
      const spaceAbove = targetRect.top;
      const spaceBelow = viewportHeight - targetBottom;
      if (spaceAbove >= PANEL_HEIGHT_ESTIMATE + 24) return { left: 12, top: 12, width };
      if (spaceBelow >= PANEL_HEIGHT_ESTIMATE + 24) return { left: 12, top: targetBottom + 12, width };
      return { left: 12, bottom: 12, width };
    }

    const targetBottom = targetRect.top + targetRect.height;
    const targetRight = targetRect.left + targetRect.width;
    const below = targetBottom + 18;
    const centeredLeft = targetRect.left + targetRect.width / 2 - width / 2;
    const left = Math.max(12, Math.min(centeredLeft, viewportWidth - width - 12));

    if (below + PANEL_HEIGHT_ESTIMATE <= viewportHeight) return { top: below, left, width };
    if (targetRect.top >= PANEL_HEIGHT_ESTIMATE + 34) {
      return { top: targetRect.top - PANEL_HEIGHT_ESTIMATE - 18, left, width };
    }

    const sideTop = Math.max(16, Math.min(targetRect.top, viewportHeight - PANEL_HEIGHT_ESTIMATE - 16));
    if (targetRect.left >= width + 30) {
      return { top: sideTop, left: targetRect.left - width - 18, width };
    }
    if (viewportWidth - targetRight >= width + 30) {
      return { top: sideTop, left: targetRight + 18, width };
    }

    return { top: Math.max(16, targetRect.top - PANEL_HEIGHT_ESTIMATE - 18), left, width };
  }, [targetRect]);

  if (!open || !step || typeof document === "undefined") return null;

  const finalStep = stepIndex === steps.length - 1;
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  return createPortal(
    <div className="ev-tour-layer" aria-live="polite">
      <div className="ev-tour-blocker" aria-hidden="true" />
      {targetRect && (
        <div
          className="ev-tour-spotlight"
          style={{
            top: Math.max(6, targetRect.top - 6),
            left: Math.max(6, targetRect.left - 6),
            width: Math.max(24, targetRect.width + 12),
            height: Math.max(24, targetRect.height + 12),
          }}
          aria-hidden="true"
        />
      )}

      <section
        ref={panelRef}
        className="ev-tour-panel"
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`Demo-rondleiding, stap ${stepIndex + 1} van ${steps.length}`}
        tabIndex={-1}
      >
        <header className="ev-tour-header">
          <div>
            <span>Demo-rondleiding</span>
            <strong>{stepIndex + 1} / {steps.length}</strong>
          </div>
          <button type="button" onClick={onSkip} aria-label="Rondleiding overslaan" title="Overslaan">
            <X size={18} />
          </button>
        </header>

        <div className="ev-tour-progress" aria-label={`${progress}% van de rondleiding voltooid`}>
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="ev-tour-copy">
          <h2>{step.title}</h2>
          <p>{step.description}</p>
        </div>

        <footer className="ev-tour-actions">
          <button type="button" className="ev-tour-skip" onClick={onSkip}>Overslaan</button>
          <div>
            <button
              type="button"
              className="ev-tour-back"
              onClick={() => onStepChange(stepIndex - 1)}
              disabled={stepIndex === 0}
              aria-label="Vorige stap"
            >
              <ArrowLeft size={17} />
            </button>
            <button
              type="button"
              className="ev-tour-next"
              onClick={() => finalStep ? onFinish() : onStepChange(stepIndex + 1)}
            >
              {finalStep ? <Check size={17} /> : null}
              {finalStep ? "Afronden" : "Volgende"}
              {!finalStep ? <ArrowRight size={17} /> : null}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
