import * as React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[#E8D9B8]/55 bg-white/88 shadow-[0_22px_70px_rgba(31,25,15,0.07),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl",
        className,
      )}
      {...props}
    />
  );
}
