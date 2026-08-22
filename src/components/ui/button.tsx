import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5BFF]/35",
  {
    variants: {
      variant: {
        default: "bg-[#0B0B0C] text-[#F5F2ED] shadow-[0_10px_24px_rgba(11,11,12,0.16)] hover:bg-[#17171A]",
        secondary: "bg-white/86 text-[#0B0B0C] shadow-[inset_0_0_0_1px_rgba(232,217,184,0.78),0_8px_22px_rgba(31,25,15,0.04)] backdrop-blur-xl hover:bg-white",
        accent: "bg-[#2D5BFF] text-white shadow-[0_14px_30px_rgba(45,91,255,0.26)] hover:bg-[#1F47E0]",
        ghost: "text-[#0B0B0C] hover:bg-[#2D5BFF]/10",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);

Button.displayName = "Button";
