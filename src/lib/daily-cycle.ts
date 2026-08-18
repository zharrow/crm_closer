import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db, leads, tasks } from "@/db/client";
import { getSettings } from "@/lib/settings";
import { enrollEligibleLeads } from "@/lib/sequences";
import { enqueue } from "@/lib/queue";
import { searchPlaces, cityFrom, postalCodeFrom } from "@/lib/places";

/**
 * Le cycle quotidien : sourcer, inscrire, rédiger.
 *
 * Il vit ici et non dans la route de cron parce qu'il a deux
 * déclencheurs — le cron Vercel de 5 h, et le bouton « Lancer un cycle »
 * des réglages. Deux copies du même enchaînement finiraient par diverger,
 * et c'est justement l'enchaînement qui dépense de l'argent.
 *
 * Chaque étape est isolée : une panne du sourcing ne doit pas empêcher la
 * rédaction des messages du jour, qui, elle, ne dépend de rien d'externe
 * hormis le modèle.
 */

export type CycleStep = "sourcing" | "enroll" | "draft";

/**
 * Ce que le cycle raconte pendant qu'il tourne.
 *
 * Sans ça, l'IHM ne peut afficher qu'un sablier : le travail lourd est
 * séquentiel et dure des minutes, et l'utilisateur n'a aucun moyen de
 * savoir s'il attend une recherche Google, quarante sondes HTTP ou vingt
 * rédactions. Chaque étape annonce donc son volume attendu, puis avance.
 */
export type CycleEvent =
  | { type: "start"; step: CycleStep; total: number | null; label: string }
  | { type: "advance"; step: CycleStep; done: number; total: number | null; label: string }
  | { type: "finish"; step: CycleStep; label: string }
  | { type: "error"; step: CycleStep; message: string }
  | { type: "done"; report: CycleReport };

export type CycleEmitter = (event: CycleEvent) => void;

export interface CycleReport {
  /** Fiches nouvelles envoyées à l'enrichissement. */
  sourced: number;
  /** Leads inscrits en séquence. */
  enrolled: number;
  /** Messages mis en rédaction. */
  drafted: number;
  errors: string[];
}

export async function runDailyCycle(emit: CycleEmitter = () => {}): Promise<CycleReport> {
  const settings = await getSettings();
  const report: CycleReport = { sourced: 0, enrolled: 0, drafted: 0, errors: [] };

  const queries = splitQueries(settings.placesQueries);
  const sourcingOn = settings.sourcingEnabled && Boolean(process.env.GOOGLE_PLACES_API_KEY);

  if (sourcingOn) {
    emit({
      type: "start",
      step: "sourcing",
      total: queries.length,
      label: `${queries.length} requête${queries.length > 1 ? "s" : ""} à lancer chez Google, jusqu'à 60 fiches chacune. Les fiches déjà connues sont mises à jour ; les nouvelles sont sondées et scorées dans la foulée.`,
    });
    try {
      report.sourced = await runSourcing(queries, emit);
      emit({
        type: "finish",
        step: "sourcing",
        label: `${report.sourced} nouvelle${report.sourced > 1 ? "s" : ""} fiche${report.sourced > 1 ? "s" : ""} enrichie${report.sourced > 1 ? "s" : ""} et scorée${report.sourced > 1 ? "s" : ""}.`,
      });
    } catch (error) {
      report.errors.push(`sourcing : ${message(error)}`);
      emit({ type: "error", step: "sourcing", message: message(error) });
    }
  } else {
    emit({
      type: "finish",
      step: "sourcing",
      label: settings.sourcingEnabled
        ? "Ignoré : aucune clé Google Places configurée."
        : "Ignoré : le sourcing automatique est désactivé.",
    });
  }

  emit({
    type: "start",
    step: "enroll",
    total: null,
    label: `Recherche des leads scorés au-dessus de ${settings.minEnrollScore}, joignables par email ou par téléphone, jamais inscrits. Au plus ${settings.enrollBatch}, meilleurs scores d'abord.`,
  });
  try {
    const created = await enrollEligibleLeads(settings.minEnrollScore, settings.enrollBatch);
    report.enrolled = created.length;
    emit({
      type: "finish",
      step: "enroll",
      label:
        report.enrolled > 0
          ? `${report.enrolled} lead${report.enrolled > 1 ? "s" : ""} inscrit${report.enrolled > 1 ? "s" : ""} : première action créée pour chacun.`
          : "Aucun lead éligible — personne au-dessus du seuil, ou tous déjà inscrits.",
    });
  } catch (error) {
    report.errors.push(`inscription : ${message(error)}`);
    emit({ type: "error", step: "enroll", message: message(error) });
  }

  emit({
    type: "start",
    step: "draft",
    total: null,
    label: `Rédaction par Claude des messages échus aujourd'hui, ${settings.dailyTaskCap} au maximum. Un appel facturé par message, quelques secondes chacun.`,
  });
  try {
    report.drafted = await draftDueTasks(settings.dailyTaskCap, emit);
    emit({
      type: "finish",
      step: "draft",
      label:
        report.drafted > 0
          ? `${report.drafted} message${report.drafted > 1 ? "s" : ""} prêt${report.drafted > 1 ? "s" : ""} à relire dans « À faire aujourd'hui ».`
          : "Aucune action échue à rédiger.",
    });
  } catch (error) {
    report.errors.push(`rédaction : ${message(error)}`);
    emit({ type: "error", step: "draft", message: message(error) });
  }

  emit({ type: "done", report });
  return report;
}

function splitQueries(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */

async function runSourcing(list: string[], emit: CycleEmitter): Promise<number> {
  if (list.length === 0) return 0;

  let sourced = 0;
  let index = 0;

  for (const query of list) {
    index++;
    emit({
      type: "advance",
      step: "sourcing",
      done: index - 1,
      total: list.length,
      label: `Recherche « ${query} »…`,
    });

    const places = await searchPlaces({ query });
    let seen = 0;

    for (const place of places) {
      seen++;
      const [row] = await db
        .insert(leads)
        .values({
          source: "google_places",
          sourceQuery: query,
          placeId: place.id,
          companyName: place.name,
          address: place.address,
          city: cityFrom(place.address),
          postalCode: postalCodeFrom(place.address),
          website: place.website,
          phone: place.phone,
          lat: place.lat,
          lng: place.lng,
          placesRefreshedAt: new Date(),
        })
        .onConflictDoUpdate({
          // `sourceQuery` n'est volontairement pas mis à jour : on garde
          // la requête qui a trouvé la fiche en premier, sinon le
          // rendement se réattribue à la dernière requête passée dessus.
          target: leads.placeId,
          set: {
            companyName: sql`excluded.company_name`,
            website: sql`excluded.website`,
            phone: sql`excluded.phone`,
            placesRefreshedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning({ id: leads.id, status: leads.status });

      if (!row) continue;

      // Ne pas ré-enrichir un lead déjà traité : le sourcing repasse sur
      // les mêmes fiches tous les jours.
      if (row.status === "new") {
        emit({
          type: "advance",
          step: "sourcing",
          done: index - 1,
          total: list.length,
          label: `« ${query} » — fiche ${seen}/${places.length} : sonde du site et scoring…`,
        });
        await enqueue("enrich-lead", { leadId: row.id });
        sourced++;
      }
    }

    emit({
      type: "advance",
      step: "sourcing",
      done: index,
      total: list.length,
      label: `« ${query} » — ${places.length} fiches vues, ${sourced} nouvelles au total.`,
    });
  }

  return sourced;
}

/**
 * Rédige les messages des tâches échues aujourd'hui. Le brouillon est
 * généré au dernier moment plutôt qu'à la création de la tâche : une
 * relance programmée dans sept jours doit partir des signaux frais, pas
 * de ceux d'il y a une semaine.
 */
async function draftDueTasks(cap: number, emit: CycleEmitter): Promise<number> {
  if (cap <= 0) return 0;

  const due = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.status, "pending"), lte(tasks.dueAt, new Date())))
    .orderBy(asc(tasks.dueAt))
    .limit(cap);

  let done = 0;
  for (const task of due) {
    emit({
      type: "advance",
      step: "draft",
      done,
      total: due.length,
      label: `Rédaction du message ${done + 1}/${due.length}…`,
    });
    await enqueue("draft-task", { taskId: task.id });
    done++;
  }

  return due.length;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
