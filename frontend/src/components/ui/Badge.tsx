import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  children: React.ReactNode;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "neutral", children, ...props }, ref) => {
    const variants = {
      success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      warning: "bg-amber-50 text-amber-700 border border-amber-200",
      error: "bg-rose-50 text-rose-700 border border-rose-200",
      info: "bg-primary-50 text-primary-700 border border-primary-200",
      neutral: "bg-slate-100 text-slate-700 border border-slate-200",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full",
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export default Badge;
