import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md" | "lg" | "icon";

/// Botones tipo "pill" como los de Apple, con foco visible y estado de carga.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover disabled:hover:bg-accent shadow-sm",
  secondary:
    "bg-surface-raised text-fg border border-line hover:bg-surface-subtle disabled:hover:bg-surface-raised",
  ghost: "text-fg hover:bg-surface-subtle disabled:hover:bg-transparent",
  danger: "bg-danger text-white hover:opacity-90 disabled:hover:opacity-100",
  link: "text-accent hover:underline underline-offset-4 p-0 h-auto rounded-none",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-[15px] gap-2",
  icon: "h-9 w-9 justify-center",
};

export interface ButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center rounded-full font-medium",
          "transition-colors duration-150 select-none",
          "disabled:opacity-45 disabled:cursor-not-allowed",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
