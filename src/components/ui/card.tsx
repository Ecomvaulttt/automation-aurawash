import * as React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn("rounded-2xl border border-[#E8D9B8]/70 bg-white shadow-sm", className)}
      {...props}
    />
  );
}
