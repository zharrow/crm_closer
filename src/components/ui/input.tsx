import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Un champ est un creux, pas un relief : jamais d'ombre portée dessus.
 *
 * Il était en `bg-transparent` avec un simple filet — donc invisible sur
 * une carte blanche tant qu'on ne cherchait pas le trait. Il est
 * maintenant *rempli* : l'aplat creuse la surface, et le filet ne fait plus
 * que borner. Les deux ensemble, parce que l'aplat seul ne donne que 1,14:1
 * contre le blanc de la carte — très en dessous des 3:1 que la règle 1.4.11
 * demande à la limite d'un composant.
 *
 * `h-10` et non `h-9` : 45 px à la racine de 112,5 %, la même hauteur que
 * les boutons. Un formulaire dont les champs et les boutons ne s'alignent
 * pas à un pixel près se voit immédiatement, sans qu'on sache dire pourquoi.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-muted/70 px-4 py-1 text-dense transition-colors file:border-0 file:bg-transparent file:text-dense file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
