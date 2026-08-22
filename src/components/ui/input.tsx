import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-[#E8D9B8]/72 bg-white/82 px-3 text-sm text-[#0B0B0C] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none transition placeholder:text-neutral-500 focus:border-[#2D5BFF] focus:bg-white focus:ring-2 focus:ring-[#2D5BFF]/18",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
