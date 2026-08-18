import { eq } from "drizzle-orm";
import { db, settings, type Settings } from "@/db/client";

/**
 * Ligne unique, créée à la volée au premier accès. Évite d'avoir à
 * lancer une commande de seed avant que l'IHM soit utilisable.
 */
export async function getSettings(): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (row) return row;

  const [created] = await db
    .insert(settings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [existing] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return existing!;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await getSettings();
  await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1));
}

/** Les réglages sans lesquels la rédaction produit un message bancal. */
export function missingSettings(s: Settings): string[] {
  const missing: string[] = [];
  if (!s.senderFirstName) missing.push("ton prénom");
  if (!s.offer) missing.push("ce que tu proposes");
  if (!s.painPoints) missing.push("les problèmes que tu résous");
  if (!s.senderIdentity) missing.push("tes mentions légales d'expéditeur");
  if (!s.bookingUrl) missing.push("ton lien de prise de rendez-vous");
  return missing;
}
