import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Le panneau, et ses cinq tons.
 *
 * Le rayon large (28 px) n'est pas un goût : c'est ce qui distingue un
 * *panneau posé sur la lumière* d'une *boîte découpée dans la page*. À
 * 12 px une carte lit comme un cadre, à 28 elle lit comme une surface
 * épaisse — et l'écart avec le rayon des contrôles devient en soi une
 * information de plan.
 *
 * Les tons sont la pièce qui manquait à l'app. Toute la hiérarchie
 * reposait sur la taille du texte, donc une page de sept cartes blanches
 * se lisait comme une liste sans début. Un aplat plein tranche la question
 * en un coup d'œil : ce bloc-là compte plus que ses voisins.
 *
 * Ils ne sont pas décoratifs et ne se choisissent pas à l'humeur —
 * DESIGN.md fixe le rôle de chacun, et il n'y en a que cinq :
 *
 *   ink     l'ossature (le rail, un pied de page)
 *   cobalt  l'action — ce qu'on vient déclencher
 *   zest    le présent — où l'on est, ce qui est ouvert
 *   amber   l'attente — un brouillon, quelque chose à relire
 *   clay    le retard — ce qui a déjà attendu
 *
 * Chaque ton porte `on-tone`, qui fait emprunter au repère de focus
 * l'encre du ton : le cobalt du focus disparaît sur un aplat cobalt.
 */
const cardVariants = cva("rounded-panel", {
  variants: {
    tone: {
      /* Pas de bordure en clair : le relief vient de l'ombre, et cumuler
         les deux donne un objet à la fois posé *et* détouré. En sombre
         l'ombre ne se voit pas et c'est l'écart de valeur qui prend le
         relais ; un filet léger l'aide à se détacher. */
      default: "bg-card text-card-foreground shadow-raised dark:border",
      ink: "on-tone bg-ink text-on-ink shadow-tone",
      cobalt: "on-tone bg-cobalt text-on-cobalt shadow-tone",
      zest: "on-tone bg-zest text-on-zest shadow-tone",
      amber: "on-tone bg-amber text-on-amber shadow-tone",
      clay: "on-tone bg-clay text-on-clay shadow-tone",
      /* Le panneau discret : il tient un groupe sans prétendre à
         l'élévation. Pour ce qui doit exister sans être regardé. */
      quiet: "bg-muted/60 text-foreground",
    },
  },
  defaultVariants: { tone: "default" },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ tone }), className)} {...props} />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

/**
 * Le titre d'un panneau est en caractère d'affichage, pas en gras du
 * texte courant : c'est le seul moyen de le distinguer d'une ligne en
 * gras à l'intérieur du panneau. À 20 px, Bricolage tient encore — c'est
 * son plancher.
 */
const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("display text-title", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-dense text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
