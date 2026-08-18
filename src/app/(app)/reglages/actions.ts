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

export async function saveSettings(formData: FormData): Promise<{ error?: string }> {
  const user = await currentUser();
  if (!user || !isAllowedEmail(user.email)) return { error: "Non autorisé" };

  const text = (key: string) => String(formData.get(key) ?? "").trim();

  /**
   * Une liste, une ligne par élément — sous forme canonique.
   *
   * Le navigateur normalise les sauts de ligne en `\r\n` à la soumission,
   * quel que soit le champ. Sans ce nettoyage, ce qui est enregistré ne
   * peut jamais être égal à ce que l'IHM recompose avec des `\n`, et
   * toute comparaison « modifié depuis la sauvegarde ? » répond oui pour
   * l'éternité, même juste après avoir enregistré.
   */
  const lines = (key: string) =>
    String(formData.get(key) ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  const number = (key: string, fallback: number) => {
    const parsed = Number(formData.get(key));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
  };

  const draftModel = text("draftModel");
  const draftEffort = text("draftEffort");

  await updateSettings({
    senderFirstName: text("senderFirstName"),
    senderIdentity: text("senderIdentity"),
    bookingUrl: text("bookingUrl"),
    offer: text("offer"),
    painPoints: text("painPoints"),
    draftModel: MODELS.includes(draftModel) ? draftModel : "claude-opus-5",
    draftEffort: EFFORTS.includes(draftEffort) ? draftEffort : "low",
    minEnrollScore: number("minEnrollScore", 40),
    enrollBatch: number("enrollBatch", 20),
    dailyTaskCap: number("dailyTaskCap", 20),
    placesQueries: lines("placesQueries"),
    sourcingEnabled: formData.get("sourcingEnabled") === "on",
  });

  revalidatePath("/", "layout");
  return {};
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
