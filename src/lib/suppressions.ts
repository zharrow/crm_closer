import { eq, or } from "drizzle-orm";
import { db, enrollments, leads, suppressions, tasks } from "@/db/client";

/**
 * Contrôle d'opposition, sur l'email exact **et** sur le domaine — une
 * exclusion notée `@exemple.fr` couvre toute la société.
 *
 * Appelé avant chaque génération de tâche et avant chaque inscription en
 * séquence. Rien ne doit pouvoir contourner ce point.
 */
export async function isSuppressed(email: string | null): Promise<boolean> {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();
  const domain = `@${normalized.split("@")[1] ?? ""}`;

  const [hit] = await db
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(or(eq(suppressions.value, normalized), eq(suppressions.value, domain)))
    .limit(1);

  return Boolean(hit);
}

export type SuppressionReason = "unsubscribe" | "complaint" | "bounce" | "manual";

/**
 * Exclut un lead : consigne l'opposition, arrête ses séquences et annule
 * les tâches encore en attente. L'entrée dans `suppressions` n'est jamais
 * purgée — c'est la preuve que l'opposition a été respectée.
 */
export async function suppressLead(
  leadId: string,
  reason: SuppressionReason,
  note?: string,
): Promise<void> {
  const [lead] = await db
    .select({ email: leads.email })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (lead?.email) {
    await db
      .insert(suppressions)
      .values({ value: lead.email.trim().toLowerCase(), reason, note })
      .onConflictDoNothing();
  }

  await db.update(leads).set({ status: "suppressed" }).where(eq(leads.id, leadId));

  await db
    .update(enrollments)
    .set({ status: "stopped", endedAt: new Date() })
    .where(eq(enrollments.leadId, leadId));

  await db
    .update(tasks)
    .set({ status: "skipped", error: "lead exclu" })
    .where(eq(tasks.leadId, leadId));
}
