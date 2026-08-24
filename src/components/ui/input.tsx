import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-[#d2d6da] bg-white px-3 text-sm text-[#344767] shadow-[inset_2px_2px_5px_rgba(203,210,217,0.2),inset_-3px_-3px_7px_rgba(255,255,255,0.88)] outline-none transition placeholder:text-[#adb5bd] focus:border-[#35d1f5] focus:ring-2 focus:ring-[#21d4fd]/18",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
