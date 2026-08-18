import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db, conversations, leadSignals, leads, messages, tasks } from "@/db/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, relativeDay } from "@/lib/utils";
import { STATUS_LABEL, STATUS_VARIANT } from "../filters";
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

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) notFound();

  const [signals, history, conversation] = await Promise.all([
    db
      .select()
      .from(leadSignals)
      .where(eq(leadSignals.leadId, id))
      .orderBy(desc(leadSignals.weight)),
    db.select().from(tasks).where(eq(tasks.leadId, id)).orderBy(desc(tasks.createdAt)),
    db.select().from(conversations).where(eq(conversations.leadId, id)).limit(1),
  ]);

  const thread = conversation[0]
    ? await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation[0].id))
        .orderBy(asc(messages.createdAt))
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/prospects"
          className="text-sm text-muted-foreground hover:underline underline-offset-4"
        >
          ← Prospects
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{lead.companyName}</h1>
          <Badge variant={STATUS_VARIANT[lead.status] ?? "outline"}>
            {STATUS_LABEL[lead.status] ?? lead.status}
          </Badge>
          {lead.score !== null && (
            <Badge variant={lead.score >= 60 ? "success" : "outline"}>Score {lead.score}</Badge>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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

      <LeadActions leadId={lead.id} status={lead.status} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Conversation leadId={lead.id} messages={thread} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Historique des actions</CardTitle>
            </CardHeader>
            <CardContent>
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
                        <span className="text-xs text-muted-foreground">
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
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Signaux détectés</CardTitle>
            </CardHeader>
            <CardContent>
              {signals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun signal. Lance l&apos;enrichissement pour sonder le site.
                </p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {signals.map((signal) => (
                    <li key={signal.id} className="flex items-start justify-between gap-3">
                      <span className="leading-relaxed">{signal.label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        +{signal.weight}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {(lead.siren || lead.headcount || lead.naf) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fiche légale</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 text-sm">
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
              </CardContent>
            </Card>
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
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
