"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface ConfirmSpec {
  /** Ce qu'on s'apprête à faire, en quelques mots. */
  title: string;
  /**
   * Le détail de ce qui va réellement se passer : effets en base, argent
   * dépensé, ce qui devient irréversible. C'est le seul endroit où tu
   * peux encore changer d'avis, donc il vaut mieux y être précis.
   */
  description: React.ReactNode;
  /** Libellé du bouton qui valide. Un verbe, pas « OK ». */
  action: string;
  destructive?: boolean;
}

export interface ActionButtonProps extends ButtonProps {
  /** Une phrase : ce que fait le bouton. Obligatoire, c'est le but. */
  tooltip: string;
  /** Présent = une modale s'interpose avant l'exécution. */
  confirm?: ConfirmSpec;
}

/**
 * Bouton d'action : infobulle systématique, confirmation optionnelle.
 *
 * L'infobulle est obligatoire parce qu'un bouton dont personne ne sait ce
 * qu'il fait ne vaut rien. La confirmation est réservée aux actions qui
 * dépensent de l'argent, changent l'état d'un lead, ou ne se rattrapent
 * pas : en mettre partout entraînerait à valider sans lire, et le garde-fou
 * ne protégerait plus rien là où il compte.
 *
 * Le déclencheur est enveloppé dans un `span` : Radix ne reçoit aucun
 * événement d'un bouton désactivé, et une action en cours est justement le
 * moment où l'on veut pouvoir relire ce que fait le bouton.
 *
 * À ne pas utiliser avec `type="submit"` et `confirm` en même temps : la
 * soumission du formulaire serait annulée par la modale.
 */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ tooltip, confirm, onClick, children, ...props }, ref) => {
    const [open, setOpen] = React.useState(false);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!confirm) {
        onClick?.(event);
        return;
      }
      event.preventDefault();
      setOpen(true);
    };

    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button ref={ref} onClick={handleClick} {...props}>
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>

        {confirm && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{confirm.title}</DialogTitle>
                <DialogDescription className="leading-relaxed">
                  {confirm.description}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button
                  variant={confirm.destructive ? "destructive" : "default"}
                  onClick={(event) => {
                    setOpen(false);
                    onClick?.(event);
                  }}
                >
                  {confirm.action}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  },
);
ActionButton.displayName = "ActionButton";
