import * as React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-2xl border-0 bg-white shadow-[0_20px_27px_0_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.95)]",
        className,
      )}
      {...props}
    />
  );
}
