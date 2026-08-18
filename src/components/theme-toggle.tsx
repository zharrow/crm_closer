"use client";

import { useLayoutEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyTheme, readTheme, THEME_KEY, THEMES, type Theme } from "@/lib/theme";

/**
 * Remet la classe que React a effacée au remontage de développement.
 *
 * Le script du layout pose la classe pendant l'analyse du HTML, ce qui suffit
 * en production. En développement, le Strict Mode de React remonte les
 * composants une fois et, à ce remontage, remet `<html>` aux seuls attributs
 * qu'il gère depuis le JSX — la classe posée par le script disparaît alors, et
 * la page s'affiche dans le thème du système en ignorant le choix enregistré.
 *
 * `useLayoutEffect` et non `useEffect` : il s'exécute avant que le navigateur
 * ne peigne, donc sans clignotement visible. Sans effet en production.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(readTheme());
  }, []);
  return null;
}

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

/**
 * Le choix du thème : trois options nommées, pas un bouton qui bascule.
 *
 * Un interrupteur unique ne peut pas dire trois états, et une icône qui
 * tourne en rond oblige à cliquer pour découvrir ce qu'elle fait. Trois
 * options écrites se lisent d'un coup — et « Système » doit rester
 * atteignable, c'est le bon défaut pour qui bascule son ordinateur en sombre
 * le soir.
 *
 * `aria-pressed` plutôt que la seule couleur de fond, comme pour les filtres
 * de la liste des prospects : sinon l'option active ne se distingue qu'à
 * l'œil.
 */
export function ThemeToggle() {
  /**
   * `null` au premier rendu, des deux côtés.
   *
   * Lire `localStorage` dans l'état initial ferait diverger le rendu du
   * serveur — qui n'y a pas accès — de celui du navigateur, et React
   * signalerait l'écart. On attend donc le montage, en `useLayoutEffect` pour
   * que ce soit fait avant l'affichage : personne ne voit les trois options
   * sans réponse.
   */
  const [theme, setTheme] = useState<Theme | null>(null);

  useLayoutEffect(() => {
    setTheme(readTheme());
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Stockage refusé : le choix vaut pour cette page, pas au-delà. Mieux
      // que de ne rien faire du tout.
    }
  };

  return (
    <div
      role="group"
      aria-label="Thème de l'interface"
      className="flex flex-wrap gap-2"
    >
      {THEMES.map(({ value, label, hint }) => {
        const Icon = ICONS[value];
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={hint}
            onClick={() => choose(value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-dense font-medium transition-colors",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
