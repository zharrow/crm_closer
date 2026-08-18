import { and, asc, desc, eq, gt, isNotNull, notExists, or, sql } from "drizzle-orm";
import {
  db,
  enrollments,
  leads,
  sequences,
  sequenceSteps,
  suppressions,
  tasks,
} from "@/db/client";
import { hoursFromNow } from "./utils";
import { isSuppressed } from "./suppressions";
import {
  SEQUENCE_BLUEPRINTS,
  sequenceKeyForLead,
  type SequenceKey,
} from "./default-sequence";

/**
 * Le moteur de séquence, sans balayage périodique.
 *
 * Une tâche porte sa date d'échéance ; elle apparaît dans la file du jour
 * quand `dueAt` est atteint, c'est tout. La tâche suivante n'est créée
 * qu'au moment où tu marques la précédente comme faite — un lead a donc
 * toujours au plus une action en attente, et une séquence abandonnée ne
 * laisse rien traîner.
 */

/**
 * La séquence d'un canal, créée à la volée si elle n'existe pas.
 *
 * Même logique que pour les réglages : l'app est inutilisable sans, donc
 * elle se crée toute seule au premier accès plutôt que d'exiger une
 * commande. `pnpm db:seed` reste disponible mais n'est plus nécessaire.
 */
export async function sequenceFor(key: SequenceKey) {
  const existing = await findByKey(key);
  if (existing) return existing;

  const blueprint = SEQUENCE_BLUEPRINTS[key];

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(sequences)
      .values(blueprint.sequence)
      .onConflictDoNothing()
      .returning({ id: sequences.id });

    if (!created) return;

    await tx
      .insert(sequenceSteps)
      .values(blueprint.steps.map((step) => ({ ...step, sequenceId: created.id })));
  });

  return findByKey(key);
}

/** La séquence qui convient à ce lead, ou `null` s'il est injoignable. */
export async function sequenceForLead(leadId: string) {
  const [lead] = await db
    .select({ email: leads.email, phone: leads.phone })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) return null;

  const key = sequenceKeyForLead(lead);
  return key ? sequenceFor(key) : null;
}

async function findByKey(key: SequenceKey) {
  const [row] = await db
    .select()
    .from(sequences)
    .where(and(eq(sequences.key, key), eq(sequences.isActive, true)))
    .orderBy(asc(sequences.createdAt))
    .limit(1);

  return row ?? null;
}

async function stepAfter(sequenceId: string, position: number) {
  const [row] = await db
    .select()
    .from(sequenceSteps)
    .where(
      and(eq(sequenceSteps.sequenceId, sequenceId), gt(sequenceSteps.position, position)),
    )
    .orderBy(asc(sequenceSteps.position))
    .limit(1);

  return row ?? null;
}

interface CreateTaskArgs {
  leadId: string;
  enrollmentId: string;
  step: typeof sequenceSteps.$inferSelect;
  dueAt: Date;
}

async function createTask({ leadId, enrollmentId, step, dueAt }: CreateTaskArgs) {
  const [task] = await db
    .insert(tasks)
    .values({
      leadId,
      enrollmentId,
      channel: step.channel,
      stepPosition: step.position,
      templateKey: step.templateKey,
      brief: step.brief,
      status: "pending",
      dueAt,
    })
    .returning({ id: tasks.id });

  await db
    .update(enrollments)
    .set({ currentPosition: step.position })
    .where(eq(enrollments.id, enrollmentId));

  return task!.id;
}

/**
 * Inscrit un lead et crée sa première tâche, échue immédiatement.
 * Renvoie l'identifiant de la tâche, ou null si le lead est déjà inscrit
 * ou exclu.
 */
export async function enrollLead(
  leadId: string,
  sequenceId: string,
): Promise<string | null> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return null;
  if (await isSuppressed(lead.email)) return null;

  const [enrollment] = await db
    .insert(enrollments)
    .values({ leadId, sequenceId })
    .onConflictDoNothing()
    .returning({ id: enrollments.id });

  if (!enrollment) return null;

  const step = await stepAfter(sequenceId, 0);
  if (!step) return null;

  await db
    .update(leads)
    .set({ status: "enrolled", updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  return createTask({
    leadId,
    enrollmentId: enrollment.id,
    step,
    dueAt: new Date(),
  });
}

/**
 * Appelée quand une tâche est marquée faite : programme la suivante à
 * `délai` heures, ou clôt l'inscription s'il n'y a plus d'étape.
 */
export async function advanceAfterTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task?.enrollmentId) return;

  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.id, task.enrollmentId), eq(enrollments.status, "active")))
    .limit(1);

  if (!enrollment) return;

  const next = await stepAfter(enrollment.sequenceId, task.stepPosition ?? 0);

  if (!next) {
    await db
      .update(enrollments)
      .set({ status: "completed", endedAt: new Date() })
      .where(eq(enrollments.id, enrollment.id));
    return;
  }

  await createTask({
    leadId: task.leadId,
    enrollmentId: enrollment.id,
    step: next,
    dueAt: hoursFromNow(next.delayHours),
  });
}

/** Une réponse rend les relances programmées caduques. */
export async function stopSequences(leadId: string, reason: string): Promise<void> {
  await db
    .update(enrollments)
    .set({ status: "stopped", endedAt: new Date() })
    .where(and(eq(enrollments.leadId, leadId), eq(enrollments.status, "active")));

  await db
    .update(tasks)
    .set({ status: "skipped", error: reason })
    .where(and(eq(tasks.leadId, leadId), eq(tasks.status, "pending")));

  await db
    .update(tasks)
    .set({ status: "skipped", error: reason })
    .where(and(eq(tasks.leadId, leadId), eq(tasks.status, "drafted")));
}

/**
 * Inscrit les leads scorés au-dessus du seuil, joignables et jamais
 * exclus. Meilleurs scores d'abord, par lots plafonnés : inscrire 500
 * leads quand tu n'en traites que vingt par jour ne ferait qu'encombrer
 * la file.
 */
export async function enrollEligibleLeads(
  minScore: number,
  batch: number,
): Promise<string[]> {
  const candidates = await db
    .select({ id: leads.id, email: leads.email, phone: leads.phone })
    .from(leads)
    .where(
      and(
        eq(leads.status, "scored"),
        sql`${leads.score} >= ${minScore}`,
        // Joignable par un canal ou par l'autre. Exiger l'email écartait
        // les leads sans site — exactement ceux que le score place en
        // tête, puisque l'absence de site vaut 40 points.
        or(isNotNull(leads.email), isNotNull(leads.phone)),
        notExists(
          db
            .select({ one: sql`1` })
            .from(enrollments)
            .where(eq(enrollments.leadId, leads.id)),
        ),
        // Sur l'email exact **et** sur le domaine, comme partout
        // ailleurs. `enrollLead` revérifie ensuite lead par lead ; ce
        // filtre évite surtout de gaspiller des places du lot avec des
        // candidats qui seront refusés juste après.
        notExists(
          db
            .select({ one: sql`1` })
            .from(suppressions)
            .where(
              sql`${suppressions.value} = ${leads.email}
                  or ${suppressions.value} = '@' || split_part(${leads.email}, '@', 2)`,
            ),
        ),
      ),
    )
    .orderBy(desc(leads.score))
    .limit(batch);

  // Une séquence par canal, résolue une seule fois pour tout le lot.
  const bySequence = new Map<SequenceKey, string>();

  const created: string[] = [];
  for (const candidate of candidates) {
    const key = sequenceKeyForLead(candidate);
    if (!key) continue;

    let sequenceId = bySequence.get(key);
    if (!sequenceId) {
      const sequence = await sequenceFor(key);
      if (!sequence) continue;
      sequenceId = sequence.id;
      bySequence.set(key, sequenceId);
    }

    const taskId = await enrollLead(candidate.id, sequenceId);
    if (taskId) created.push(taskId);
  }

  return created;
}
