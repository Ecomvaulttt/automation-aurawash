import * as React from "react";
import { cn } from "../../lib/utils";

type BadgeTone = "neutral" | "good" | "warn" | "danger" | "accent";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  accent: "bg-[#A7C7E7]/45 text-neutral-950 ring-[#A7C7E7]",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
