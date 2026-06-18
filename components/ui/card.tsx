import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — Design System v2.
 * Radius `var(--radius-lg)` = 20px. Brand rule: "border OR shadow-sm, not both"
 * — default `Card` uses border only; pass `variant="elevated"` for shadow-only.
 * Default padding 28px (`p-7`); compact mode is 20px (`p-5`). Call sites can
 * always override with their own `p-*` className.
 */
type CardVariant = "default" | "elevated" | "ghost";
type CardPadding = "default" | "compact" | "none";

const variantClass: Record<CardVariant, string> = {
  default: "border border-border bg-card text-card-foreground",
  elevated: "bg-card text-card-foreground shadow-sm",
  ghost: "bg-transparent"
};

const paddingClass: Record<CardPadding, string> = {
  default: "p-7", // 28px
  compact: "p-5", // 20px
  none: ""
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", padding = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg",
        variantClass[variant],
        paddingClass[padding],
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-display text-xl font-bold leading-tight tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-4", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center pt-4", className)} {...props} />
));
CardFooter.displayName = "CardFooter";
