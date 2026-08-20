import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * `[&_svg]:pointer-events-none` a été retiré volontairement.
 *
 * C'est un héritage de shadcn : il rendait le SVG transparent au pointeur
 * pour qu'il ne devienne jamais la cible d'un clic. Le clic fonctionne de
 * toute façon — il remonte au bouton — mais les icônes animées, elles,
 * reçoivent leurs gestionnaires de survol *sur le SVG lui-même*. Avec
 * `pointer-events: none`, `onMouseEnter` ne se déclenchait jamais et aucune
 * icône ne s'animait dans un bouton.
 *
 * Ne pas le remettre sans vérifier le survol des icônes.
 */

/**
 * Le bouton est une pilule, et c'est une décision de fond.
 *
 * Un rayon de 6 px sur un bouton de 45 px de haut donne un rectangle aux
 * angles cassés : la forme ne dit rien, elle se contente de ne pas être
 * carrée. La pilule, elle, se reconnaît de loin et à la périphérie du
 * regard — c'est la seule forme de l'interface qui signifie « on appuie
 * ici ». Les panneaux gardent le grand rayon, les champs le moyen : trois
 * géométries, trois natures d'objet, aucune ambiguïté.
 *
 * La hauteur par défaut passe de `h-9` à `h-10`. À la racine de 112,5 %
 * cela fait **45 px** — au-dessus des 44 px que réclame une cible tactile,
 * seuil que l'app n'atteignait nulle part et qui traînait en dette depuis
 * le début.
 */
const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,box-shadow,filter,transform] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        /* L'action principale porte le ton de l'action. Blanc sur cobalt :
           8,87:1, très au-dessus du plancher — un bouton qu'on ne peut pas
           lire est un bouton qu'on n'appuie pas. */
        default: "bg-cobalt text-on-cobalt shadow-tone hover:brightness-110",
        /* L'action principale en négatif, quand elle est posée sur un fond
           déjà coloré et que le cobalt s'y perdrait. */
        ink: "on-tone bg-ink text-on-ink shadow-tone hover:brightness-125",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
        /* Le contour porte deux pixels et non un : à un pixel, sur une
           nappe en dégradé, le trait disparaît par endroits. */
        outline: "border-2 border-input bg-card/70 hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:brightness-95",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 text-dense",
        sm: "h-9 px-4 text-meta",
        lg: "h-12 px-7 text-body",
        /* Un cercle parfait. C'est la forme des affordances secondaires des
           deux références : elles se posent au coin d'un panneau sans jamais
           se disputer la lecture avec son contenu. */
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
