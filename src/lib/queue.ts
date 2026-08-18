import { Client, Receiver } from "@upstash/qstash";

/**
 * Vercel Hobby limite le cron à une exécution par jour et les fonctions à
 * 60 s. Le sourcing d'une centaine de fiches ne tient donc pas dans une
 * seule invocation : le cron se contente de découper le travail et de
 * déposer un message par lead dans QStash, qui rappelle l'application
 * fonction par fonction.
 *
 * Sans jeton QStash (développement local), le job s'exécute directement
 * dans le processus courant — même code, pas de service à lancer.
 */

export type JobName = "enrich-lead" | "draft-task";

export interface JobPayload {
  "enrich-lead": { leadId: string };
  "draft-task": { taskId: string };
}

let client: Client | null = null;

function getClient(): Client | null {
  if (!process.env.QSTASH_TOKEN) return null;
  if (!client) client = new Client({ token: process.env.QSTASH_TOKEN });
  return client;
}

export function queueEnabled(): boolean {
  return Boolean(process.env.QSTASH_TOKEN && process.env.NEXT_PUBLIC_APP_URL);
}

export async function enqueue<T extends JobName>(
  job: T,
  payload: JobPayload[T],
  options: { delaySeconds?: number } = {},
): Promise<void> {
  const qstash = getClient();
  const base = process.env.NEXT_PUBLIC_APP_URL;

  if (!qstash || !base) {
    // Repli local : exécution en ligne, sans passer par le réseau.
    const { runJob } = await import("@/jobs");
    await runJob(job, payload);
    return;
  }

  await qstash.publishJSON({
    url: `${base.replace(/\/$/, "")}/api/jobs/${job}`,
    body: payload,
    ...(options.delaySeconds ? { delay: options.delaySeconds } : {}),
    retries: 2,
  });
}

let receiver: Receiver | null = null;

/**
 * Les routes de job sont publiques : c'est la signature QStash qui fait
 * l'authentification, pas la session. Sans clés configurées on refuse
 * tout — un endpoint de job non signé est un endpoint ouvert.
 */
export async function verifyQstashSignature(
  signature: string | null,
  body: string,
): Promise<boolean> {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!current || !next || !signature) return false;

  if (!receiver) {
    receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next });
  }

  try {
    return await receiver.verify({ signature, body });
  } catch {
    return false;
  }
}
