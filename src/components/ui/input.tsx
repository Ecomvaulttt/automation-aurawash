import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-[#E8D9B8]/80 bg-white px-3 text-sm text-[#0B0B0C] outline-none transition placeholder:text-neutral-500 focus:border-[#2D5BFF] focus:ring-2 focus:ring-[#2D5BFF]/20",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
