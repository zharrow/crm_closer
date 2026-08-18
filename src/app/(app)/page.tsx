import Link from "next/link";
import { ScrollMemory } from "@/components/scroll-memory";
import { and, asc, count, eq, gte, lte, sql } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { db, leads, tasks } from "@/db/client";
import { getSettings, missingSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { TaskQueue } from "./task-queue";

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

/**
 * Les compteurs, en deux requêtes et non en quatre.
 *
 * Le pooler transactionnel de Supabase tient mal les requêtes empilées :
 * `src/db/client.ts` fixe le pool à 5 pour cette raison, et cette page en
 * lance déjà trois familles en parallèle. Trois `count()` sur la même table
 * qui ne diffèrent que par leur filtre n'ont aucune raison d'occuper trois
 * connexions — `count(*) filter (where …)` les fait en une passe. Le total
 * concurrent de la page redescend ainsi sous ce qu'il était avant l'ajout
 * du compteur du jour.
 */
async function loadCounters() {
  // Minuit local : ce qui compte est « depuis ce matin », pas « depuis 24 h ».
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const [[leadCounts], [doneToday]] = await Promise.all([
    db
      .select({
        total: count(),
        engaged: sql<number>`count(*) filter (where ${leads.status} = 'engaged')`.mapWith(Number),
        booked: sql<number>`count(*) filter (where ${leads.status} = 'booked')`.mapWith(Number),
      })
      .from(leads),
    db
      .select({ n: count() })
      .from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.doneAt, midnight))),
  ]);

  return {
    engaged: leadCounts?.engaged ?? 0,
    booked: leadCounts?.booked ?? 0,
    total: leadCounts?.total ?? 0,
    doneToday: doneToday?.n ?? 0,
  };
}

/**
 * Une file vide veut dire trois choses différentes, et elles n'appelaient
 * qu'un seul écran : « File vide. Ajoute des prospects. »
 *
 * Or terminer sa journée et n'avoir jamais commencé se ressemblaient donc
 * trait pour trait. Le seul moment de la journée où il y a quelque chose à
 * fêter — la file passe à zéro parce que tu l'as vidée — était rendu par le
 * même gris que l'installation neuve, et par un conseil (« ajoute des
 * prospects ») qui ne s'adressait pas à toi.
 */
function EmptyQueue({ doneToday, hasLeads }: { doneToday: number; hasLeads: boolean }) {
  if (doneToday > 0) {
    return (
      <Card className="border-success/40 bg-success/5">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
          <p className="font-medium">
            {doneToday} action{doneToday > 1 ? "s" : ""} envoyée
            {doneToday > 1 ? "s" : ""} aujourd&apos;hui. C&apos;est fini pour la journée.
          </p>
          <p className="max-w-md leading-relaxed text-muted-foreground">
            Les relances programmées reviennent ici à leur date. Rien à surveiller
            d&apos;ici là.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (hasLeads) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="max-w-md leading-relaxed text-muted-foreground">
            Rien à faire aujourd&apos;hui. Les relances déjà programmées
            apparaîtront à leur date — tu n&apos;as rien à déclencher.
          </p>
          <Link href="/prospects?statut=scored" className="font-medium underline underline-offset-4">
            Inscrire d&apos;autres prospects en séquence
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="max-w-md leading-relaxed text-muted-foreground">
          Aucun prospect pour l&apos;instant. Importe un CSV, ou laisse le sourcing
          en trouver depuis les réglages.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/import" className="font-medium underline underline-offset-4">
            Importer un CSV
          </Link>
          <Link href="/reglages" className="text-muted-foreground underline underline-offset-4">
            Configurer le sourcing
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Les compteurs, sur une ligne.
 *
 * Trois cartes de la largeur de la page occupaient la bande la plus lue de
 * l'écran — celle qu'on regarde en premier — pour trois nombres sur
 * lesquels il n'y a rien à faire, sur une page dont le titre annonce du
 * travail. La première action commençait à 340 px du haut ; elle démarre
 * maintenant à 150, et une deuxième entre dans le premier écran.
 *
 * Rien n'est retiré : les trois nombres sont là, toujours cliquables vers
 * leur liste filtrée. Ils ont seulement cessé d'être l'événement.
 */
function Counters({
  total,
  engaged,
  booked,
}: {
  total: number;
  engaged: number;
  booked: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3 text-meta text-muted-foreground">
      <Counter label="leads" value={total} href="/prospects" />
      <Counter label="ont répondu" value={engaged} href="/prospects?statut=engaged" />
      <Counter label="RDV" value={booked} href="/prospects?statut=booked" />
    </div>
  );
}

function Counter({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded transition-colors hover:text-foreground"
    >
      <span className="font-semibold tabular-nums text-foreground">{value}</span> {label}
    </Link>
  );
}

export default async function TodayPage() {
  const [dueTasks, counters, settings] = await Promise.all([
    loadDueTasks(),
    loadCounters(),
    getSettings(),
  ]);

  const missing = missingSettings(settings);

  // La frontière du retard est décidée ici, une fois, et sert à la fois au
  // regroupement et à la couleur de la date dans chaque carte. La calculer
  // aussi côté client exposerait à un écart de fuseau entre le rendu serveur
  // et l'hydratation — et à deux définitions du mot « en retard ».
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const late = dueTasks.filter((task) => new Date(task.dueAt) < midnight);
  const today = dueTasks.filter((task) => new Date(task.dueAt) >= midnight);

  return (
    <div className="flex flex-col gap-8">
      <ScrollMemory />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">À faire aujourd&apos;hui</h1>
        <p className="mt-1.5 text-muted-foreground">
          {dueTasks.length > 0
            ? `${dueTasks.length} action${dueTasks.length > 1 ? "s" : ""} en attente${
                late.length > 0 ? ` — ${late.length} en retard` : ""
              }. Tu copies, tu envoies, tu marques.`
            : "Rien en attente. Les relances programmées apparaîtront ici à leur date."}
        </p>
        <Counters
          total={counters.total}
          engaged={counters.engaged}
          booked={counters.booked}
        />
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

      {dueTasks.length === 0 ? (
        <EmptyQueue doneToday={counters.doneToday} hasLeads={counters.total > 0} />
      ) : (
        <TaskQueue late={late} today={today} />
      )}
    </div>
  );
}
