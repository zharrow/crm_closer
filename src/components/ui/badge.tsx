import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * La pastille passe de l'aplat pâle au ton plein.
 *
 * Elle était rendue en teinte à 15 % avec un texte assombri : lisible,
 * mesuré, et parfaitement invisible à un mètre de l'écran. Or une pastille
 * sert précisément à être vue sans être lue — un score, un canal, un état
 * se repèrent à la couleur avant que le mot ne soit déchiffré.
 *
 * Deux familles, et elles ne se mélangent pas :
 *
 * — les TONS pleins (`default`, `success`, `warning`, `destructive`) pour
 *   ce qui hiérarchise : un score, un retard, une action ;
 * — les PASTILLES pâles (`email`, `phone`, `linkedin`, `secondary`) pour
 *   ce qui étiquette : un canal, un état neutre. Une étiquette qui crie
 *   autant qu'un score fait perdre le score.
 *
 * Toutes portent leur encre dédiée, mesurée à 7:1 sur leur propre fond —
 * jamais `text-foreground` posé à l'aveugle sur un aplat coloré.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-meta font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "bg-cobalt text-on-cobalt",
        ink: "bg-ink text-on-ink",
        /* Acquis, obtenu. Le zeste est la couleur la plus voyante de la
           palette et c'est voulu : un score élevé est ce qu'on cherche des
           yeux en parcourant une liste de deux cents lignes. */
        success: "bg-zest text-on-zest",
        warning: "bg-amber text-on-amber",
        destructive: "bg-clay text-on-clay",
        secondary: "bg-chip-neutral text-on-chip-neutral",
        outline: "border border-border text-foreground",
        email: "bg-chip-email text-on-chip-email",
        phone: "bg-chip-phone text-on-chip-phone",
        linkedin: "bg-chip-linkedin text-on-chip-linkedin",
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
