"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, bookings, conversations, leads, messages, tasks } from "@/db/client";
import { runJob } from "@/jobs";
import { advanceAfterTask, enrollLead, sequenceForLead, stopSequences } from "@/lib/sequences";
import { suppressLead } from "@/lib/suppressions";
import { suggestReply, type ReplySuggestion } from "@/lib/reply";
import { describeError } from "@/lib/anthropic";
import { currentUser, isAllowedEmail } from "@/lib/supabase/server";
import { normalizeUrl } from "@/lib/utils";

/**
 * Les Server Actions sont des endpoints POST : le middleware protège la
 * navigation, pas elles. Chaque action revérifie donc la session — sans
 * ce garde, une action reste appelable sans être connecté.
 */
async function assertAuthenticated(): Promise<void> {
  const user = await currentUser();
  if (!user || !isAllowedEmail(user.email)) {
    throw new Error("Non autorisé");
  }
}

function refresh() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Tâches                                                              */
/* ------------------------------------------------------------------ */

export async function draftTaskNow(taskId: string): Promise<{ error?: string }> {
  await assertAuthenticated();
  try {
    await db.update(tasks).set({ status: "pending", error: null }).where(eq(tasks.id, taskId));
    await runJob("draft-task", { taskId });
    refresh();
    return {};
  } catch (error) {
    return { error: describeError(error) };
  }
}

export async function saveTaskDraft(
  taskId: string,
  subject: string | null,
  body: string,
): Promise<void> {
  await assertAuthenticated();
  await db
    .update(tasks)
    .set({ subject, body, status: "drafted" })
    .where(eq(tasks.id, taskId));
  refresh();
}

/**
 * Tu as envoyé le message à la main. On l'enregistre dans le fil, puis on
 * programme l'étape suivante de la séquence.
 */
export async function markTaskDone(taskId: string): Promise<void> {
  await assertAuthenticated();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return;

  await db
    .update(tasks)
    .set({ status: "done", doneAt: new Date() })
    .where(eq(tasks.id, taskId));

  if (task.body) {
    const conversationId = await ensureConversation(task.leadId);
    await db.insert(messages).values({
      conversationId,
      role: "us",
      channel: task.channel,
      body: task.body,
    });
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  await advanceAfterTask(taskId);
  refresh();
}

export async function skipTask(taskId: string): Promise<void> {
  await assertAuthenticated();
  await db
    .update(tasks)
    .set({ status: "skipped", error: "ignorée manuellement" })
    .where(eq(tasks.id, taskId));
  await advanceAfterTask(taskId);
  refresh();
}

export async function snoozeTask(taskId: string, days: number): Promise<void> {
  await assertAuthenticated();
  await db
    .update(tasks)
    .set({ dueAt: new Date(Date.now() + days * 86_400_000) })
    .where(eq(tasks.id, taskId));
  refresh();
}

/* ------------------------------------------------------------------ */
/* Conversation                                                        */
/* ------------------------------------------------------------------ */

async function ensureConversation(leadId: string): Promise<string> {
  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(conversations)
    .values({ leadId })
    .onConflictDoNothing()
    .returning({ id: conversations.id });

  if (created) return created.id;

  const [fallback] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .limit(1);

  return fallback!.id;
}

/**
 * Le prospect a répondu. Une réponse rend les relances programmées
 * caduques : on les arrête immédiatement, avant toute autre chose.
 */
export async function logReply(leadId: string, body: string): Promise<void> {
  await assertAuthenticated();
  const trimmed = body.trim();
  if (!trimmed) return;

  const conversationId = await ensureConversation(leadId);

  await db.insert(messages).values({ conversationId, role: "prospect", body: trimmed });
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId));

  await stopSequences(leadId, "le prospect a répondu");
  await db
    .update(leads)
    .set({ status: "engaged", updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  refresh();
}

export async function logOutbound(leadId: string, body: string): Promise<void> {
  await assertAuthenticated();
  const trimmed = body.trim();
  if (!trimmed) return;

  const conversationId = await ensureConversation(leadId);
  await db.insert(messages).values({ conversationId, role: "us", body: trimmed });
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId));

  refresh();
}

export async function requestReplySuggestion(
  leadId: string,
): Promise<{ suggestion?: ReplySuggestion; error?: string }> {
  await assertAuthenticated();
  try {
    return { suggestion: await suggestReply(leadId) };
  } catch (error) {
    return { error: describeError(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

export async function enrichLeadNow(leadId: string): Promise<{ error?: string }> {
  await assertAuthenticated();
  try {
    await runJob("enrich-lead", { leadId });
    refresh();
    return {};
  } catch (error) {
    return { error: describeError(error) };
  }
}

export async function enrollLeadNow(leadId: string): Promise<{ error?: string }> {
  await assertAuthenticated();

  const sequence = await sequenceForLead(leadId);
  if (!sequence) {
    return { error: "Ce prospect n'a ni email ni téléphone : aucun canal pour le contacter." };
  }

  const taskId = await enrollLead(leadId, sequence.id);
  if (!taskId) return { error: "Lead déjà inscrit, ou exclu." };

  // Volontairement sans rédaction : la première action apparaît dans la
  // file avec son bouton « Rédiger le message ». S'inscrire ne doit pas
  // dépenser un appel que tu n'as pas demandé.
  refresh();
  return {};
}

export async function updateLeadNotes(leadId: string, notes: string): Promise<void> {
  await assertAuthenticated();
  await db
    .update(leads)
    .set({ notes, updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  refresh();
}

export async function excludeLead(leadId: string, note?: string): Promise<void> {
  await assertAuthenticated();
  await suppressLead(leadId, "manual", note);
  refresh();
}

export async function markLost(leadId: string): Promise<void> {
  await assertAuthenticated();
  await stopSequences(leadId, "lead abandonné");
  await db
    .update(leads)
    .set({ status: "lost", updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  await db
    .update(conversations)
    .set({ status: "closed_lost" })
    .where(eq(conversations.leadId, leadId));
  refresh();
}

export async function markBooked(leadId: string, isoDate: string): Promise<void> {
  await assertAuthenticated();
  const scheduledAt = new Date(isoDate);
  if (Number.isNaN(scheduledAt.getTime())) return;

  await db.insert(bookings).values({ leadId, scheduledAt });
  await stopSequences(leadId, "rendez-vous obtenu");
  await db
    .update(leads)
    .set({ status: "booked", updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  await db
    .update(conversations)
    .set({ status: "closed_won" })
    .where(eq(conversations.leadId, leadId));

  refresh();
}

export async function markWon(leadId: string): Promise<void> {
  await assertAuthenticated();
  await db
    .update(leads)
    .set({ status: "won", updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  refresh();
}

export interface NewLeadInput {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  linkedinUrl?: string;
}

export async function createLead(input: NewLeadInput): Promise<{ id?: string; error?: string }> {
  await assertAuthenticated();

  const companyName = input.companyName.trim();
  if (!companyName) return { error: "Le nom de l'entreprise est obligatoire." };

  const [lead] = await db
    .insert(leads)
    .values({
      source: "manual",
      status: "new",
      companyName,
      contactName: input.contactName?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
      website: normalizeUrl(input.website),
      city: input.city?.trim() || null,
      linkedinUrl: input.linkedinUrl?.trim() || null,
    })
    .returning({ id: leads.id });

  refresh();
  return { id: lead!.id };
}
