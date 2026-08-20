import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

/**
 * Le champ de date.
 *
 * Il reste le contrôle **natif** — `globals.css` en règle les trois parties
 * visibles, et la raison de ne pas le remplacer est écrite là-bas : le
 * sélecteur du système, la navigation au clavier, le format local. Ce
 * composant n'ajoute qu'une chose, mais que le CSS ne peut pas faire seul.
 *
 * Un champ de date vide affiche son gabarit — `jj/mm/aaaa` — et le
 * navigateur le peint comme une valeur, en encre pleine. C'est faux : ce
 * n'est pas une date, c'est l'annonce de la forme qu'on attend, et ça se
 * tient en retrait comme un `placeholder`. Or aucun sélecteur ne dit « ce
 * champ de date est vide » : `:placeholder-shown` ne s'applique pas ici, et
 * `:invalid` ne se déclenche que si le champ est requis. Le composant, lui,
 * le sait — d'où `data-vide`, que le CSS attend.
 *
 * La hauteur suit `Input` (45 px, celle des boutons). Dans une rangée de
 * boutons `sm`, passer `h-9` : un champ qui dépasse ses voisins de quatre
 * pixels se voit, sans qu'on sache dire pourquoi.
 */
export interface DateFieldProps extends Omit<React.ComponentProps<"input">, "type"> {
  /** `datetime-local` par défaut : un rendez-vous a une heure. */
  type?: "date" | "datetime-local" | "time";
}

const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  ({ className, type = "datetime-local", value, ...props }, ref) => (
    <Input
      ref={ref}
      type={type}
      value={value}
      data-vide={value ? undefined : ""}
      className={cn(className)}
      {...props}
    />
  ),
);
DateField.displayName = "DateField";

export { DateField };
