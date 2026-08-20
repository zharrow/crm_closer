import Link from "next/link";
import { ScrollMemory } from "@/components/scroll-memory";
import { and, asc, count, eq, gte, lte, sql } from "drizzle-orm";
import { AlertTriangle, CalendarCheck, CheckCircle2, Inbox, MessageSquare, Users } from "lucide-react";
import { db, leads, tasks } from "@/db/client";
import { getSettings, missingSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Stat, StatRow } from "@/components/stat";
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
      /* Le seul moment de la journée qui mérite d'être marqué se rend en
         ton plein, pas en teinte à 5 %. Zeste : le présent, ce qui est
         acquis maintenant. */
      <Card tone="zest">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-9 w-9" aria-hidden />
          <p className="display text-headline">
            {doneToday} action{doneToday > 1 ? "s" : ""} envoyée
            {doneToday > 1 ? "s" : ""} aujourd&apos;hui. C&apos;est fini pour la journée.
          </p>
          <p className="max-w-md text-body leading-relaxed opacity-80">
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

export default async function TodayPage() {
  /* Quatre requêtes concurrentes ici, plus une pour le rail. Toute requête
     ajoutée à ce `Promise.all` doit être comptée sur le total de la page, pas
     sur celui de sa fonction — un compteur posé sans ce calcul a déjà suffi
     à faire échouer la file. */
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
      {/* Titre à gauche, chiffres à droite : la ligne de tête des deux
          références. Le titre passe de 24 à 45 px — c'est le levier le
          moins cher de toute la direction artistique, et celui qu'on
          n'ose jamais tirer. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <h1 className="display text-display">À faire aujourd&apos;hui</h1>
          <p className="mt-3 max-w-xl text-body text-muted-foreground">
            {dueTasks.length > 0
              ? `${dueTasks.length} action${dueTasks.length > 1 ? "s" : ""} en attente${
                  late.length > 0 ? ` — ${late.length} en retard` : ""
                }. Tu copies, tu envoies, tu marques.`
              : "Rien en attente. Les relances programmées apparaîtront ici à leur date."}
          </p>
        </div>
        <StatRow>
          <Stat
            icon={Users}
            chip="bg-chip-neutral text-on-chip-neutral"
            label="leads"
            value={counters.total}
            href="/prospects"
          />
          <Stat
            icon={MessageSquare}
            chip="bg-chip-email text-on-chip-email"
            label="ont répondu"
            value={counters.engaged}
            href="/prospects?statut=engaged"
          />
          <Stat
            icon={CalendarCheck}
            chip="bg-zest text-on-zest"
            label="RDV"
            value={counters.booked}
            href="/prospects?statut=booked"
          />
        </StatRow>
      </div>

      {missing.length > 0 && (
        <Card tone="amber">
          <CardContent className="flex items-start gap-3 p-5 text-dense">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="leading-relaxed">
              Il manque {missing.join(", ")} dans les{" "}
              <Link href="/reglages" className="font-semibold underline underline-offset-2">
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
