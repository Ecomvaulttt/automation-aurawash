import * as React from "react";
import { cn } from "../../lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-[#d2d6da] bg-white px-3 text-sm text-[#344767] shadow-[0_1px_2px_rgba(31,39,61,0.03)] outline-none transition focus:border-[#2D5BFF] focus:ring-2 focus:ring-[#2D5BFF]/12",
        className,
      )}
      {...props}
    />
  ),
);

Select.displayName = "Select";
