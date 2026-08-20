"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, querySuggestions, type QuerySuggestion } from "@/db/client";
import { describeError } from "@/lib/anthropic";
import { pendingSuggestions, proposeQueries } from "@/lib/query-suggestions";
import { updateSettings } from "@/lib/settings";
import { currentUser, isAllowedEmail } from "@/lib/supabase/server";

const MODELS = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"];
const EFFORTS = ["low", "medium", "high"];

/**
 * Un champ, une règle de nettoyage — et une seule table pour toute la page.
 *
 * La page enregistrait tout d'un coup : un formulaire, un bouton, une action
 * qui lisait un `FormData` entier. Chaque champ s'enregistre maintenant seul,
 * et c'est exactement le moment où l'on est tenté d'écrire une deuxième
 * validation « juste pour ce champ-là ». Deux chemins d'écriture pour les
 * mêmes réglages finissent toujours par ne pas valider la même chose, et
 * l'écart ne se voit que le jour où il fait des dégâts.
 *
 * D'où cette table : elle est la *seule* description de ce qu'un réglage a
 * le droit de valoir. `saveSetting` ne sait rien faire d'autre que la
 * consulter, et une clé absente d'ici est refusée — ce qui interdit à un
 * appel client de fabriquer un nom de colonne.
 */
const FIELDS = {
  senderFirstName: (raw) => String(raw ?? "").trim(),
  senderIdentity: (raw) => String(raw ?? "").trim(),
  bookingUrl: (raw) => String(raw ?? "").trim(),
  offer: (raw) => String(raw ?? "").trim(),
  painPoints: (raw) => String(raw ?? "").trim(),
  proofPoints: (raw) => String(raw ?? "").trim(),

  draftModel: (raw) => (MODELS.includes(String(raw)) ? String(raw) : "claude-opus-5"),
  draftEffort: (raw) => (EFFORTS.includes(String(raw)) ? String(raw) : "low"),

  minEnrollScore: (raw) => bounded(raw, 0, 100, 40),
  enrollBatch: (raw) => bounded(raw, 0, 200, 20),

  /**
   * Une liste, une ligne par élément — sous forme canonique.
   *
   * Le navigateur normalise les sauts de ligne en `\r\n` dès qu'un texte
   * passe par un champ. Sans ce nettoyage, ce qui est enregistré ne peut
   * jamais être égal à ce que l'IHM recompose avec des `\n`, et toute
   * comparaison « est-ce que ça a changé ? » répond oui pour l'éternité.
   */
  placesQueries: (raw) =>
    String(raw ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n"),

  sourcingEnabled: (raw) => raw === true || raw === "on" || raw === "true",
} satisfies Record<string, (raw: unknown) => string | number | boolean>;

export type SettingKey = keyof typeof FIELDS;

function bounded(raw: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/**
 * Enregistre un réglage, et renvoie **ce qui a réellement été écrit**.
 *
 * Le retour n'est pas une politesse : le nettoyage peut changer la valeur —
 * une espace de trop disparaît, un seuil à 150 redescend à 100, une liste se
 * réordonne. Sans bouton « Enregistrer », l'écran est la seule confirmation
 * qu'on ait ; il doit donc afficher la valeur de la base, pas celle qu'on
 * croit avoir tapée.
 */
export async function saveSetting(
  key: string,
  raw: unknown,
): Promise<{ value?: string | number | boolean; error?: string }> {
  const user = await currentUser();
  if (!user || !isAllowedEmail(user.email)) return { error: "Non autorisé" };

  const clean = (FIELDS as Record<string, ((raw: unknown) => string | number | boolean) | undefined>)[key];
  if (!clean) return { error: `Réglage inconnu : ${key}` };

  const value = clean(raw);

  try {
    await updateSettings({ [key]: value });
  } catch (error) {
    return { error: describeError(error) };
  }

  /* La file du jour affiche « il manque … dans les réglages », et le rail
     compte les actions dues : les deux lisent ces valeurs. Sans
     revalidation, on corrige un réglage et l'avertissement reste affiché
     ailleurs dans l'app. */
  revalidatePath("/", "layout");
  return { value };
}

/* ------------------------------------------------------------------ */
/* Propositions de requêtes de sourcing                                */
/* ------------------------------------------------------------------ */

/**
 * Demande une salve de propositions au modèle et renvoie la liste en
 * attente. On renvoie la liste plutôt qu'un simple compteur : l'IHM peut
 * ainsi se mettre à jour sans recharger la page, donc sans écraser ce
 * que tu es en train de taper dans les réglages.
 */
export async function suggestQueries(): Promise<{
  suggestions?: QuerySuggestion[];
  added?: number;
  error?: string;
}> {
  const user = await currentUser();
  if (!user || !isAllowedEmail(user.email)) return { error: "Non autorisé" };

  try {
    const { added, error } = await proposeQueries();
    if (error) return { error };
    return { added, suggestions: await pendingSuggestions() };
  } catch (error) {
    return { error: describeError(error) };
  }
}

/** Retenue : la requête part dans la liste de sourcing côté IHM. */
export async function acceptSuggestion(id: string): Promise<{ error?: string }> {
  return decide(id, "accepted");
}

/** Écartée : elle ne sera plus jamais reproposée. */
export async function dismissSuggestion(id: string): Promise<{ error?: string }> {
  return decide(id, "dismissed");
}

/** Remise en jeu : un refus doit pouvoir se défaire. */
export async function restoreSuggestion(id: string): Promise<{ error?: string }> {
  return decide(id, "proposed");
}

async function decide(
  id: string,
  status: "accepted" | "dismissed" | "proposed",
): Promise<{ error?: string }> {
  const user = await currentUser();
  if (!user || !isAllowedEmail(user.email)) return { error: "Non autorisé" };

  await db
    .update(querySuggestions)
    .set({ status, decidedAt: status === "proposed" ? null : new Date() })
    .where(eq(querySuggestions.id, id));

  return {};
}
