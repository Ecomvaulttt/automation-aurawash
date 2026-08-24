import * as React from "react";
import { cn } from "../../lib/utils";

type BadgeTone = "neutral" | "good" | "warn" | "danger" | "accent";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-[#f8f9fa] text-[#67748e] ring-[#e9ecef]",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  accent: "bg-[#e9f8ff] text-[#2152ff] ring-[#21d4fd]/25",
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
