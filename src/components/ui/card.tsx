import * as React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[#E8D9B8]/60 bg-white/92 shadow-[0_18px_60px_rgba(11,11,12,0.06)] backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}
