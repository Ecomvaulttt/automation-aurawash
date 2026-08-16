import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-500 focus:border-neutral-950 focus:ring-2 focus:ring-[#A7C7E7]",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
