import Link from "next/link";
import { ScrollMemory } from "@/components/scroll-memory";
import { and, asc, count, eq, lte, sql } from "drizzle-orm";
import { AlertTriangle, Inbox } from "lucide-react";
import { db, leads, tasks } from "@/db/client";
import { getSettings, missingSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { TaskCard } from "./task-card";

export const dynamic = "force-dynamic";

async function loadDueTasks() {
  return db
    .select({
      id: tasks.id,
      channel: tasks.channel,
      status: tasks.status,
      subject: tasks.subject,
      body: tasks.body,
      error: tasks.error,
      dueAt: tasks.dueAt,
      stepPosition: tasks.stepPosition,
      leadId: leads.id,
      companyName: leads.companyName,
      contactName: leads.contactName,
      email: leads.email,
      phone: leads.phone,
      website: leads.website,
      linkedinUrl: leads.linkedinUrl,
      score: leads.score,
      scoreRationale: leads.scoreRationale,
    })
    .from(tasks)
    .innerJoin(leads, eq(leads.id, tasks.leadId))
    .where(
      and(
        lte(tasks.dueAt, new Date()),
        sql`${tasks.status} in ('pending', 'drafted', 'failed')`,
      ),
    )
    .orderBy(asc(tasks.dueAt));
}

async function loadCounters() {
  const [[engaged], [booked], [total]] = await Promise.all([
    db.select({ n: count() }).from(leads).where(eq(leads.status, "engaged")),
    db.select({ n: count() }).from(leads).where(eq(leads.status, "booked")),
    db.select({ n: count() }).from(leads),
  ]);

  return { engaged: engaged?.n ?? 0, booked: booked?.n ?? 0, total: total?.n ?? 0 };
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <div className="rounded-xl border bg-card p-5 transition-colors hover:border-foreground/25">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function TodayPage() {
  const [dueTasks, counters, settings] = await Promise.all([
    loadDueTasks(),
    loadCounters(),
    getSettings(),
  ]);

  const missing = missingSettings(settings);

  return (
    <div className="flex flex-col gap-8">
      <ScrollMemory />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">À faire aujourd&apos;hui</h1>
        <p className="mt-1.5 text-muted-foreground">
          {dueTasks.length > 0
            ? `${dueTasks.length} action${dueTasks.length > 1 ? "s" : ""} en attente. Tu copies, tu envoies, tu marques.`
            : "Rien en attente. Les relances programmées apparaîtront ici à leur date."}
        </p>
      </div>

      {missing.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="leading-relaxed">
              Il manque {missing.join(", ")} dans les{" "}
              <Link href="/reglages" className="font-medium underline underline-offset-2">
                réglages
              </Link>
              . Les messages seront rédigés sans ces éléments, donc plus faibles.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Leads" value={counters.total} href="/prospects" />
        <Stat label="Ont répondu" value={counters.engaged} href="/prospects?statut=engaged" />
        <Stat label="RDV obtenus" value={counters.booked} href="/prospects?statut=booked" />
      </div>

      {dueTasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              File vide. Ajoute des prospects puis inscris-les en séquence depuis leur fiche.
            </p>
            <Link href="/prospects" className="text-sm font-medium underline underline-offset-4">
              Voir les prospects
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {dueTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
