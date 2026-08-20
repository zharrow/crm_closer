import Link from "next/link";
import { and, eq, gte, lt, or, sql } from "drizzle-orm";
import { CalendarClock, CheckCircle2, Inbox, TrendingUp } from "lucide-react";
import { db, tasks } from "@/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Stat, StatRow } from "@/components/stat";
import { RhythmChart, type RhythmDay } from "@/components/rhythm-chart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rythme" };

/** Trois semaines derrière, une devant. */
const PAST_DAYS = 21;
const FUTURE_DAYS = 7;

/**
 * Le rythme, en **une** requête.
 *
 * `src/db/client.ts` fixe le pool à 8 et documente pourquoi. Cette page-ci
 * n'en occupe qu'une, plus une pour le rail — mais la règle vaut quand même :
 * les deux séries voyagent ensemble parce qu'il n'y a aucune raison qu'elles
 * prennent deux connexions, et parce que la page a vocation à s'étoffer.
 *
 * Le découpage en jours se fait côté Node et non en SQL, délibérément.
 * `::date` en Postgres découpe sur le fuseau de la session — UTC chez
 * Supabase — alors que le reste de l'app raisonne en minuit local
 * (`setHours(0, 0, 0, 0)`). Deux définitions du mot « jour » dans la même app
 * finiraient par ne pas tomber d'accord sur ce qu'est aujourd'hui.
 *
 * Les bornes passent par `gte`/`lt` et jamais par un `Date` posé dans un
 * gabarit `sql` : sans le contexte de la colonne, postgres.js reçoit un
 * `Date` sans indication de type et refuse de le sérialiser. Le dépôt s'est
 * déjà fait prendre une fois.
 */
async function loadRhythm(): Promise<RhythmDay[]> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const start = new Date(midnight);
  start.setDate(start.getDate() - PAST_DAYS);
  const end = new Date(midnight);
  end.setDate(end.getDate() + FUTURE_DAYS + 1);

  const rows = await db
    .select({ status: tasks.status, doneAt: tasks.doneAt, dueAt: tasks.dueAt })
    .from(tasks)
    .where(
      or(
        and(eq(tasks.status, "done"), gte(tasks.doneAt, start), lt(tasks.doneAt, end)),
        and(
          sql`${tasks.status} in ('pending', 'drafted', 'failed')`,
          gte(tasks.dueAt, start),
          lt(tasks.dueAt, end),
        ),
      ),
    );

  // Toutes les colonnes existent avant d'être remplies : un jour sans rien
  // est une information, pas un trou à combler après coup.
  const days: RhythmDay[] = [];
  const index = new Map<number, RhythmDay>();
  for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset++) {
    const date = new Date(midnight);
    date.setDate(date.getDate() + offset);
    const day = { date, sent: 0, due: 0 };
    days.push(day);
    index.set(date.getTime(), day);
  }

  const bucket = (value: Date | string | null) => {
    if (!value) return undefined;
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return index.get(d.getTime());
  };

  for (const row of rows) {
    if (row.status === "done") {
      const day = bucket(row.doneAt);
      if (day) day.sent += 1;
    } else {
      const day = bucket(row.dueAt);
      if (day) day.due += 1;
    }
  }

  return days;
}

/**
 * Les trois chiffres se déduisent de la même série : aucune requête de plus.
 *
 * La moyenne se prend sur les **jours travaillés** et non sur les vingt et un
 * jours de la fenêtre. Diviser par les week-ends et les jours de congé
 * fabriquerait une moyenne que personne n'a jamais faite, et qui ne
 * répondrait à aucune question — surtout pas à « est-ce que je tiens mon
 * rythme quand je m'y mets ? ».
 */
function summarise(days: RhythmDay[]) {
  const now = new Date();
  const past = days.filter((day) => day.date <= now);

  const sent = past.reduce((total, day) => total + day.sent, 0);
  const worked = past.filter((day) => day.sent > 0).length;
  const due = days.reduce((total, day) => total + day.due, 0);

  return {
    sent,
    due,
    perDay: worked === 0 ? "—" : (sent / worked).toFixed(1).replace(".", ","),
  };
}

export default async function RhythmPage() {
  const days = await loadRhythm();
  const { sent, due, perDay } = summarise(days);
  const empty = sent === 0 && due === 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Même ligne de tête que la file du jour et que les réglages : titre à
          gauche, chiffres au bout. Trois écrans qui s'ouvrent de la même
          façon se reconnaissent comme appartenant à la même app. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <h1 className="display text-display">Rythme</h1>
          <p className="mt-3 max-w-xl text-body text-muted-foreground">
            Ce qui est parti sur les trois dernières semaines, et ce qui reste
            dû. Rien à faire ici : c&apos;est un compte rendu, pas une file.
          </p>
        </div>

        {!empty && (
          <StatRow>
            <Stat
              icon={CheckCircle2}
              chip="bg-zest text-on-zest"
              label="envoyées"
              value={sent}
            />
            <Stat
              icon={TrendingUp}
              chip="bg-chip-neutral text-on-chip-neutral"
              label="par jour travaillé"
              value={perDay}
            />
            <Stat
              icon={CalendarClock}
              chip="bg-amber text-on-amber"
              label="encore dues"
              value={due}
              href="/"
            />
          </StatRow>
        )}
      </div>

      {empty ? (
        /* Distinguer « rien à montrer » de « rien ne s'est passé » : ici
           c'est le second, et le geste attendu n'est pas sur cette page. */
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="max-w-md text-body leading-relaxed text-muted-foreground">
              Rien à montrer pour l&apos;instant : aucune action n&apos;a été
              envoyée ni programmée sur la période. Le graphique se remplit tout
              seul dès que la file tourne.
            </p>
            <Link href="/" className="font-medium underline underline-offset-4">
              Aller à la file du jour
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <RhythmChart days={days} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
