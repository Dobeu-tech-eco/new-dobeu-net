import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — Design System v2.
 * Pill radius (999), uppercase 11px Nunito 700, 0.03em tracking.
 * Three tones: indigo (10% tint), amber (10% tint), neutral (muted).
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-pill text-[11px] font-bold uppercase tracking-[0.03em] px-[9px] py-[5px] leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        indigo:
          "bg-[hsl(var(--brand-tint-indigo-10))] text-[hsl(var(--dobeu-indigo-700))]",
        amber:
          "bg-[hsl(var(--brand-tint-amber-10))] text-[hsl(var(--dobeu-amber-600))]",
        neutral: "bg-secondary text-secondary-foreground"
      }
    },
    defaultVariants: { tone: "indigo" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
