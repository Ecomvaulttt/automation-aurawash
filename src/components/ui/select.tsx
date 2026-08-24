import * as React from "react";
import { cn } from "../../lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-[#d2d6da] bg-white px-3 text-sm text-[#344767] shadow-[inset_2px_2px_5px_rgba(203,210,217,0.2),inset_-3px_-3px_7px_rgba(255,255,255,0.88)] outline-none transition focus:border-[#35d1f5] focus:ring-2 focus:ring-[#21d4fd]/18",
        className,
      )}
      {...props}
    />
  ),
);

Select.displayName = "Select";
