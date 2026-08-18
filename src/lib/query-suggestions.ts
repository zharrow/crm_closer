import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, enrollments, leads, querySuggestions, type QuerySuggestion } from "@/db/client";
import { completeStructured } from "./anthropic";
import { getSettings } from "./settings";

/**
 * Propositions de requêtes de sourcing, adossées aux résultats réels.
 *
 * Deux mémoires distinctes alimentent le modèle :
 *
 * - le **rendement** de chaque requête déjà lancée, reconstruit depuis
 *   `leads.source_query` — c'est ce qui distingue une proposition
 *   informée d'une idée en l'air ;
 * - les requêtes **déjà proposées**, retenues comme écartées, pour ne
 *   jamais resservir la même chose. Un rejet est une information : il
 *   dit qu'un métier ou une zone ne t'intéresse pas.
 */

export interface QueryYield {
  query: string;
  /** Fiches ramenées par cette requête. */
  leads: number;
  /** Fiches avec au moins un canal : email ou téléphone. */
  reachable: number;
  /** Joignables **et** au-dessus du seuil d'inscription. */
  eligible: number;
  /** Réellement inscrites en séquence. */
  enrolled: number;
  avgScore: number | null;
}

/**
 * L'entonnoir de chaque requête, pas seulement son volume.
 *
 * Compter les fiches ramenées ne dit rien d'utile : une requête peut en
 * ramener soixante dont aucune n'est exploitable. Les colonnes suivent
 * donc la vie réelle d'un lead — sourcé, joignable, au-dessus du seuil,
 * inscrit — pour qu'on voie à quelle étape ça meurt.
 */
export async function queryYield(threshold: number): Promise<QueryYield[]> {
  const rows = await db
    .select({
      query: leads.sourceQuery,
      leads: sql<number>`count(*)::int`,
      reachable: sql<number>`count(*) filter (where ${leads.email} is not null or ${leads.phone} is not null)::int`,
      eligible: sql<number>`count(*) filter (where ${leads.score} >= ${threshold} and (${leads.email} is not null or ${leads.phone} is not null))::int`,
      enrolled: sql<number>`count(*) filter (where exists (select 1 from ${enrollments} where ${enrollments.leadId} = ${leads.id}))::int`,
      avgScore: sql<number | null>`round(avg(${leads.score}))::int`,
    })
    .from(leads)
    .where(isNotNull(leads.sourceQuery))
    .groupBy(leads.sourceQuery)
    .orderBy(desc(sql`count(*)`));

  return rows as QueryYield[];
}

export interface ThresholdOption {
  threshold: number;
  /** Inscriptibles à ce seuil, par email. */
  viaEmail: number;
  /** Inscriptibles à ce seuil, par téléphone faute d'email. */
  viaPhone: number;
}

/**
 * Ce que donnerait chaque seuil possible, calculé sur les scores
 * réellement présents en base plutôt que sur une échelle arbitraire :
 * chaque ligne est un point de bascule réel, pas une graduation ronde
 * qui ne change rien.
 */
export async function thresholdSimulation(): Promise<ThresholdOption[]> {
  const buckets = await db
    .select({
      score: leads.score,
      viaEmail: sql<number>`count(*) filter (where ${leads.email} is not null)::int`,
      viaPhone: sql<number>`count(*) filter (where ${leads.email} is null and ${leads.phone} is not null)::int`,
    })
    .from(leads)
    .where(and(eq(leads.status, "scored"), isNotNull(leads.score)))
    .groupBy(leads.score)
    .orderBy(desc(leads.score));

  // Cumul décroissant : un seuil retient tout ce qui est au-dessus.
  let email = 0;
  let phone = 0;
  return buckets.map((bucket) => {
    email += bucket.viaEmail;
    phone += bucket.viaPhone;
    return { threshold: bucket.score ?? 0, viaEmail: email, viaPhone: phone };
  });
}

/** Les requêtes écartées, pour pouvoir revenir sur un refus. */
export async function dismissedSuggestions(): Promise<QuerySuggestion[]> {
  return db
    .select()
    .from(querySuggestions)
    .where(eq(querySuggestions.status, "dismissed"))
    .orderBy(desc(querySuggestions.decidedAt));
}

/** Les propositions en attente de décision. */
export async function pendingSuggestions(): Promise<QuerySuggestion[]> {
  return db
    .select()
    .from(querySuggestions)
    .where(eq(querySuggestions.status, "proposed"))
    .orderBy(desc(querySuggestions.createdAt));
}

/** Plafond d'une salve. Repris dans le prompt et appliqué au retour. */
const MAX_SUGGESTIONS = 6;

const SYSTEM = `Tu proposes des requêtes de recherche pour l'API Google Places Text Search,
dans le cadre d'une prospection commerciale B2B en France.

Une bonne requête tient en trois à cinq mots : un métier précis, puis une
ville ou un arrondissement. « plombier Toulouse », « agence immobilière
Blagnac », « boulangerie Toulouse Saint-Cyprien ». Elle vise un
établissement physique avec une fiche Google — donc un commerce, un
artisan, un cabinet, jamais une entreprise purement en ligne.

Ce qui rend une proposition utile :

- le métier correspond à ce que vend l'utilisateur, pas à un secteur
  vaguement voisin ;
- elle explore une piste que la liste actuelle ne couvre pas, soit un
  métier nouveau, soit une zone nouvelle sur un métier qui marche déjà ;
- quand les chiffres de rendement montrent qu'un métier convertit bien,
  décline-le sur d'autres communes plutôt que de changer de métier ;
- quand un métier ramène beaucoup de fiches mais aucun engagement, ne le
  décline pas, propose autre chose.

Écris les requêtes en français, en minuscules sauf pour les noms propres.
Le justificatif fait une phrase courte, factuelle, sans superlatif : il
dit sur quoi tu t'appuies.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    // Pas de `maxItems` ici : le sous-ensemble de JSON Schema accepté par les
    // sorties structurées rejette les contraintes de cardinalité et renvoie
    // une 400. Le plafond est tenu par le prompt, et garanti par le `slice`
    // ci-dessous — une contrainte de format ne se délègue pas au modèle.
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["query", "rationale"],
        properties: {
          query: { type: "string" },
          rationale: { type: "string" },
        },
      },
    },
  },
} as const;

interface ModelOutput {
  suggestions: { query: string; rationale: string }[];
}

/**
 * Demande une salve de propositions et enregistre les nouvelles.
 *
 * Les doublons sont écartés deux fois : par le prompt, qui reçoit la
 * liste complète de ce qui a déjà été vu, et par l'index unique sur
 * `lower(query)`, qui rattrape ce que le modèle laisserait passer.
 */
export async function proposeQueries(): Promise<{ added: number; error?: string }> {
  const settings = await getSettings();

  if (!settings.offer && !settings.painPoints) {
    return {
      added: 0,
      error:
        "Renseigne d'abord ce que tu proposes et les problèmes que tu résous : sans ça, les propositions seraient génériques.",
    };
  }

  const [yields, known] = await Promise.all([
    queryYield(settings.minEnrollScore),
    db.select({ query: querySuggestions.query, status: querySuggestions.status }).from(querySuggestions),
  ]);

  const current = settings.placesQueries
    .split("\n")
    .map((q) => q.trim())
    .filter(Boolean);

  const seen = new Set(
    [...current, ...known.map((k) => k.query)].map((q) => q.toLowerCase()),
  );

  const { data } = await completeStructured<ModelOutput>({
    model: settings.draftModel,
    system: SYSTEM,
    prompt: buildPrompt({ settings, current, yields, known }),
    schema: SCHEMA,
    effort: "low",
    maxTokens: 1500,
  });

  const fresh = data.suggestions
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => ({ query: s.query.trim(), rationale: s.rationale.trim() }))
    .filter((s) => s.query && !seen.has(s.query.toLowerCase()));

  if (fresh.length === 0) return { added: 0 };

  const inserted = await db
    .insert(querySuggestions)
    .values(fresh)
    .onConflictDoNothing()
    .returning({ id: querySuggestions.id });

  return { added: inserted.length };
}

interface PromptArgs {
  settings: { offer: string; painPoints: string };
  current: string[];
  yields: QueryYield[];
  known: { query: string; status: string }[];
}

function buildPrompt({ settings, current, yields, known }: PromptArgs): string {
  const lines: string[] = [];

  lines.push(`Ce que vend l'utilisateur : ${settings.offer || "non renseigné"}`);
  lines.push(`Les problèmes qu'il résout : ${settings.painPoints || "non renseigné"}`);

  lines.push("");
  lines.push(
    current.length > 0
      ? `Requêtes actuellement actives :\n${current.map((q) => `- ${q}`).join("\n")}`
      : "Aucune requête active pour l'instant : commence par les métiers les plus évidents au vu de l'offre.",
  );

  if (yields.length > 0) {
    lines.push("");
    lines.push("Rendement observé, étape par étape :");
    for (const y of yields) {
      lines.push(
        `- ${y.query} : ${y.leads} sourcés · ${y.reachable} joignables · ${y.eligible} au-dessus du seuil · ${y.enrolled} inscrits · score moyen ${y.avgScore ?? "n/a"}`,
      );
    }
  }

  const dismissed = known.filter((k) => k.status === "dismissed").map((k) => k.query);
  const alreadySeen = known.map((k) => k.query);

  if (dismissed.length > 0) {
    lines.push("");
    lines.push(
      `Écartées par l'utilisateur — ne repropose ni celles-ci ni des variantes proches :\n${dismissed
        .map((q) => `- ${q}`)
        .join("\n")}`,
    );
  }

  if (alreadySeen.length > 0) {
    lines.push("");
    lines.push(
      `Déjà proposées par le passé, à ne pas répéter :\n${alreadySeen.map((q) => `- ${q}`).join("\n")}`,
    );
  }

  lines.push("");
  lines.push(`Propose au plus ${MAX_SUGGESTIONS} requêtes nouvelles.`);

  return lines.join("\n");
}
