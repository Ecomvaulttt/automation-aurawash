import * as React from "react";
import { cn } from "../../lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-[#E8D9B8]/72 bg-white/82 px-3 text-sm text-[#0B0B0C] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none transition focus:border-[#2D5BFF] focus:bg-white focus:ring-2 focus:ring-[#2D5BFF]/18",
        className,
      )}
      {...props}
    />
  ),
);

Select.displayName = "Select";
