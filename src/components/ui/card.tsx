import * as React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[#dee2e6]/60 bg-white shadow-[0_12px_28px_rgba(31,39,61,0.05),inset_0_1px_0_rgba(255,255,255,0.95)]",
        className,
      )}
      {...props}
    />
  );
}
