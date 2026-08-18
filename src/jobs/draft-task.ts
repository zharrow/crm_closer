import { eq } from "drizzle-orm";
import { db, leads, tasks } from "@/db/client";
import { draftMessage } from "@/lib/compose";
import { describeError } from "@/lib/anthropic";
import { getSettings } from "@/lib/settings";
import { isSuppressed } from "@/lib/suppressions";
import type { ChannelKey } from "@/lib/templates";

/**
 * Rédige le message d'une tâche et la fait passer en `drafted`.
 *
 * Dernier point de contrôle avant qu'un texte te soit présenté : on
 * revérifie l'exclusion ici même si elle a déjà été vérifiée en amont.
 * Une vérification qui doit être infaillible se fait au plus près de
 * l'action, pas une seule fois en début de chaîne.
 */
export async function draftTask({ taskId }: { taskId: string }): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task || task.status !== "pending") return;

  const [lead] = await db.select().from(leads).where(eq(leads.id, task.leadId)).limit(1);
  if (!lead) return;

  if (await isSuppressed(lead.email)) {
    await db
      .update(tasks)
      .set({ status: "skipped", error: "lead en liste d'exclusion" })
      .where(eq(tasks.id, taskId));
    return;
  }

  if (task.channel === "email" && !lead.email) {
    await db
      .update(tasks)
      .set({ status: "skipped", error: "aucune adresse email connue" })
      .where(eq(tasks.id, taskId));
    return;
  }

  try {
    const settings = await getSettings();
    const draft = await draftMessage({
      lead,
      settings,
      channel: task.channel as ChannelKey,
      templateKey: task.templateKey,
      brief: task.brief,
    });

    await db
      .update(tasks)
      .set({
        status: "drafted",
        subject: draft.subject,
        body: draft.body,
        error: draft.warnings.length > 0 ? `À relire : ${draft.warnings.join(", ")}` : null,
      })
      .where(eq(tasks.id, taskId));
  } catch (error) {
    await db
      .update(tasks)
      .set({ status: "failed", error: describeError(error) })
      .where(eq(tasks.id, taskId));
  }
}
