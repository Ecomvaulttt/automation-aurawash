import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-[#d2d6da] bg-white px-3 text-sm text-[#344767] shadow-[0_1px_2px_rgba(31,39,61,0.03)] outline-none transition placeholder:text-[#adb5bd] focus:border-[#2D5BFF] focus:ring-2 focus:ring-[#2D5BFF]/12",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
