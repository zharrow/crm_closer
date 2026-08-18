import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        /* Aplat pâle + texte assombri : la teinte pure ne passe pas AA en
           12px sur son propre fond, d'où les jetons `-on-tint`. */
        success: "border-transparent bg-success/15 text-success-on-tint",
        warning: "border-transparent bg-warning/20 text-warning-on-tint",
        outline: "text-foreground",
        /* Le canal doit se reconnaître sans lire le mot. */
        email: "border-transparent bg-channel-email/12 text-channel-email-on-tint",
        phone: "border-transparent bg-channel-phone/15 text-channel-phone-on-tint",
        linkedin: "border-transparent bg-channel-linkedin/12 text-channel-linkedin-on-tint",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
