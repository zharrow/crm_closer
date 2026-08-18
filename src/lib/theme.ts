/**
 * Le thème : préférence système, ou choix explicite.
 *
 * Le CSS savait déjà faire — `:root:not(.light)` sous la media query, `.dark`
 * en dur — mais rien n'a jamais posé ces classes : on subissait donc le
 * réglage de l'OS sans recours. Un thème qu'on ne peut pas changer n'est pas
 * un thème, c'est une contrainte.
 *
 * Les valeurs stockées portent le nom des classes CSS (`light`, `dark`)
 * plutôt qu'un libellé français : une couche de traduction de plus entre le
 * stockage et le sélecteur serait une occasion de plus de se tromper. Le
 * français est dans l'interface, pas dans les jetons.
 */
export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "theme";

export const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: "system", label: "Système", hint: "Suit le réglage de ton ordinateur." },
  { value: "light", label: "Clair", hint: "Toujours clair, quel que soit l'ordinateur." },
  { value: "dark", label: "Sombre", hint: "Toujours sombre, quel que soit l'ordinateur." },
];

export function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Pose ou retire les classes, sans toucher au reste de `className`.
 *
 * `classList` et non une réécriture complète : `<html>` porte aussi les
 * variables de police posées par `next/font`, qu'un remplacement effacerait.
 */
export function applyTheme(theme: Theme): void {
  const classes = document.documentElement.classList;
  classes.remove("light", "dark");
  if (theme !== "system") classes.add(theme);
}

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // Navigation privée, stockage bloqué : on suit le système, comme avant.
    return "system";
  }
}

/**
 * Le même travail, en une ligne exécutée pendant l'analyse du HTML.
 *
 * C'est ce qui évite le clignotement : un `useEffect` s'exécute après le
 * premier rendu à l'écran, donc trop tard — on verrait le thème du système
 * apparaître puis être corrigé. Ce script-ci tourne avant que quoi que ce
 * soit ne soit peint.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});var c=document.documentElement.classList;c.remove("light","dark");if(t==="light"||t==="dark")c.add(t)}catch(e){}})()`;
