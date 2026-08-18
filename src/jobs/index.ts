import type { JobName, JobPayload } from "@/lib/queue";
import { enrichLead } from "./enrich-lead";
import { draftTask } from "./draft-task";

/**
 * Un seul point d'entrée, partagé entre la route QStash et l'exécution
 * locale en ligne. Les noms de jobs sont typés : une faute de frappe est
 * une erreur de compilation, pas un message qui part dans le vide.
 */
const JOBS = {
  "enrich-lead": enrichLead,
  "draft-task": draftTask,
} satisfies { [K in JobName]: (payload: JobPayload[K]) => Promise<void> };

export function isJobName(value: string): value is JobName {
  return value in JOBS;
}

export async function runJob<T extends JobName>(
  job: T,
  payload: JobPayload[T],
): Promise<void> {
  await (JOBS[job] as (p: JobPayload[T]) => Promise<void>)(payload);
}
