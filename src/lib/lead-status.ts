import type { BadgeProps } from "@/components/ui/badge";

/**
 * Le vocabulaire des statuts, hors de tout composant.
 *
 * Ces tables vivaient dans `prospects/filters.tsx`, qui porte `"use client"`.
 * Un module client n'expose pas ses valeurs à un composant serveur qui
 * l'importe : côté serveur, `STATUS_LABEL["enrolled"]` ne rendait rien, et
 * les deux lectures tombaient sur leur repli — le libellé sur la valeur
 * brute, la teinte sur `outline`. La liste des prospects affichait donc
 * « enrolled », « scored », « won » en anglais et en gris, dans une
 * interface entièrement française, tandis que les boutons de filtre juste
 * au-dessus — rendus par le client, eux — affichaient « En séquence ».
 *
 * Ce ne sont pas des composants, seulement du vocabulaire. Il n'a rien à
 * faire dans une frontière client.
 *
 * L'ordre suit `leadStatus` dans `db/schema.ts` : six étapes qui se suivent,
 * puis trois sorties. `LeadPipeline` s'appuie sur ce même ordre.
 */
export const STATUS_LABEL: Record<string, string> = {
  new: "Nouveau",
  enriched: "Enrichi",
  scored: "Scoré",
  enrolled: "En séquence",
  engaged: "A répondu",
  booked: "RDV",
  won: "Signé",
  lost: "Perdu",
  suppressed: "Exclu",
};

/**
 * Les trois registres de DESIGN.md, et rien de plus : le vert dit « acquis »
 * (RDV pris, affaire signée), l'ocre « à surveiller » (il a répondu, à toi
 * de jouer), la brique « problème » (exclu). Le reste est neutre — un
 * prospect qui avance dans la séquence n'appelle aucune vigilance.
 */
export const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  new: "outline",
  enriched: "outline",
  scored: "secondary",
  enrolled: "secondary",
  engaged: "warning",
  booked: "success",
  won: "success",
  lost: "outline",
  suppressed: "destructive",
};

/** Ce qu'on propose de filtrer : les étapes sur lesquelles on agit. */
export const STATUS_FILTERS = [
  "tous",
  "scored",
  "enrolled",
  "engaged",
  "booked",
  "won",
  "lost",
  "suppressed",
] as const;
