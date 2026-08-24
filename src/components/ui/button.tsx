import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5BFF]/35",
  {
    variants: {
      variant: {
        default: "bg-[#344767] text-white shadow-[0_4px_7px_rgba(52,71,103,0.18)] hover:bg-[#2b3c5a]",
        secondary: "bg-white text-[#344767] shadow-[inset_2px_2px_5px_rgba(203,210,217,0.28),inset_-3px_-3px_7px_rgba(255,255,255,0.9),0_4px_7px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)]",
        accent: "bg-[linear-gradient(310deg,#2152ff,#21d4fd)] text-white shadow-[0_4px_11px_rgba(33,82,255,0.28)] hover:shadow-[0_8px_18px_rgba(33,82,255,0.34)]",
        ghost: "text-[#344767] hover:bg-white hover:shadow-[0_4px_7px_rgba(0,0,0,0.04)]",
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
