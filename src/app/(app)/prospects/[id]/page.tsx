import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db, conversations, leadSignals, leads, messages, tasks } from "@/db/client";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, relativeDay, scoreTone } from "@/lib/utils";
import { Section } from "@/components/section";
import { SignalDetail } from "@/components/signal-detail";
import { LeadPipeline } from "@/components/lead-pipeline";
import { LeadActions } from "./lead-actions";
import { Conversation } from "./conversation";
import { LeadNotes } from "./lead-notes";

export const dynamic = "force-dynamic";

const TASK_STATUS_LABEL: Record<string, string> = {
  pending: "À rédiger",
  drafted: "Brouillon prêt",
  done: "Envoyé",
  skipped: "Ignoré",
  failed: "Échec",
};

/**
 * D'où l'on vient, et donc où « retour » ramène.
 *
 * Le lien était écrit en dur vers la liste des prospects : en arrivant
 * depuis la file du jour, il renvoyait ailleurs que d'où l'on venait, et on
 * perdait sa place dans la file. Un fil d'Ariane qui se trompe de parent est
 * pire que pas de fil du tout — on lui fait confiance.
 */
const ORIGINS = {
  file: { href: "/", label: "À faire" },
  liste: { href: "/prospects", label: "Prospects" },
} as const;

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ depuis?: string }>;
}) {
  const { id } = await params;
  const { depuis } = await searchParams;

  // Valeur inconnue ou absente : la liste, qui reste le parent naturel.
  const origin = depuis === "file" ? ORIGINS.file : ORIGINS.liste;

  /**
   * Les quatre requêtes partent ensemble, et non en trois vagues.
   *
   * La page allait chercher le lead, puis — une fois celui-ci arrivé — ses
   * signaux, son historique et sa conversation, puis — une fois la
   * conversation arrivée — les messages de cette conversation. Trois
   * allers-retours Postgres empilés là où aucun n'a besoin du résultat du
   * précédent : `id` vient de l'URL, il est connu dès la première ligne.
   *
   * Le fil de messages passait par l'identifiant de la conversation ; il se
   * joint directement sur `lead_id`, qui est unique par conversation
   * (`conversations_lead_key`). Une conversation au plus, donc aucune
   * ligne dupliquée — et une vague au lieu de trois.
   */
  const [[lead], signals, history, thread] = await Promise.all([
    db.select().from(leads).where(eq(leads.id, id)).limit(1),
    db
      .select()
      .from(leadSignals)
      .where(eq(leadSignals.leadId, id))
      .orderBy(desc(leadSignals.weight)),
    db.select().from(tasks).where(eq(tasks.leadId, id)).orderBy(desc(tasks.createdAt)),
    db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        role: messages.role,
        channel: messages.channel,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(eq(conversations.leadId, id))
      .orderBy(asc(messages.createdAt)),
  ]);

  if (!lead) notFound();

  /**
   * Les dates d'étape, prises dans ce que la page a déjà chargé.
   *
   * Aucune requête de plus pour dater la piste : `createdAt`,
   * `enrichedAt` et `scoredAt` viennent de la fiche, l'inscription se lit
   * à la première action créée pour ce prospect — `enrollLeadNow` crée
   * l'inscription et cette action dans le même geste — et la réponse au
   * premier message entrant. `history` descend des plus récentes aux plus
   * anciennes, d'où `.at(-1)` ; `thread` monte, d'où `.find()`.
   *
   * `booked` n'y figure pas : la prise de RDV n'est horodatée nulle part
   * en base. L'étape s'affiche sans date, ce qui est la seule chose
   * honnête à en dire.
   */
  const firstTask = history.at(-1);
  const firstReply = thread.find((message) => message.role === "prospect");

  const pipelineDates = {
    new: lead.createdAt,
    enriched: lead.enrichedAt,
    scored: lead.scoredAt,
    enrolled: firstTask?.createdAt ?? null,
    engaged: firstReply?.createdAt ?? null,
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={origin.href}
          className="text-dense text-muted-foreground hover:underline underline-offset-4"
        >
          ← {origin.label}
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="display text-display text-balance">{lead.companyName}</h1>
          {/* Le statut n'est plus une pastille ici : la piste, plus bas, le
              dit en entier — où l'on en est, ce qui a été franchi, ce qui
              reste. Le répéter en un mot au-dessus n'ajoutait rien et
              entrait en concurrence avec le score, qui lui n'est écrit
              qu'ici. */}
          {lead.score !== null && (
            <>
              <Badge variant={scoreTone(lead.score)}>
                Score <span className="numeric">{lead.score}</span>
              </Badge>
              {/* Le détail répond à la question que le total masque :
                  gros prospect au site correct, ou petite structure sans
                  rien du tout ? Les deux peuvent faire 40. */}
              <span className="numeric text-xs text-muted-foreground">
                besoin {lead.needScore ?? "—"} · valeur {lead.valueScore ?? "—"}
                {lead.reviewCount !== null && ` · ${lead.reviewCount} avis`}
              </span>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-dense text-muted-foreground">
          {lead.contactName && <span>{lead.contactName}</span>}
          {lead.email && <span>{lead.email}</span>}
          {lead.phone && <span>{lead.phone}</span>}
          {lead.city && <span>{lead.city}</span>}
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              Site <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {lead.linkedinUrl && (
            <a
              href={lead.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              LinkedIn <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <LeadPipeline status={lead.status} dates={pipelineDates} />

      <LeadActions leadId={lead.id} status={lead.status} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Conversation leadId={lead.id} messages={thread} />

          <Section title="Historique des actions" count={history.length}>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune action. Inscris ce prospect en séquence pour en générer.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {history.map((task) => (
                  <li key={task.id} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">{task.channel}</Badge>
                      <span className="text-muted-foreground">
                        {TASK_STATUS_LABEL[task.status] ?? task.status}
                      </span>
                      {/* Une date se compare d'une ligne à l'autre : c'est
                          de la donnée, elle prend le caractère technique. */}
                      <span className="numeric text-xs text-muted-foreground">
                        {task.doneAt
                          ? formatDateTime(task.doneAt)
                          : `échéance ${relativeDay(task.dueAt)}`}
                      </span>
                    </div>
                    {task.error && (
                      <p className="text-xs text-muted-foreground">{task.error}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title="Signaux détectés" count={signals.length}>
            {signals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun signal. Lance l&apos;enrichissement pour sonder le site.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {signals.map((signal) => (
                  <SignalDetail
                    key={signal.id}
                    kind={signal.kind}
                    label={signal.label}
                    weight={signal.weight}
                    headcount={lead.headcount}
                  />
                ))}
              </ul>
            )}
          </Section>

          {(lead.siren || lead.headcount || lead.naf) && (
            <Section title="Fiche légale">
              <dl className="flex flex-col gap-1.5 text-sm">
                {lead.siren && <Row label="SIREN" value={lead.siren} />}
                {lead.naf && <Row label="NAF" value={lead.naf} />}
                {lead.headcount != null && (
                  <Row label="Effectif" value={String(lead.headcount)} />
                )}
                {lead.incorporatedAt && (
                  <Row
                    label="Création"
                    value={new Date(lead.incorporatedAt).getFullYear().toString()}
                  />
                )}
              </dl>
            </Section>
          )}

          <LeadNotes leadId={lead.id} notes={lead.notes ?? ""} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      {/* SIREN, code NAF, effectif, année : de la donnée, pas de la prose. */}
      <dd className="numeric font-medium">{value}</dd>
    </div>
  );
}
