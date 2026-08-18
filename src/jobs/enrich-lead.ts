import { eq } from "drizzle-orm";
import { db, leadSignals, leads } from "@/db/client";
import { probeWebsite, type Signal } from "@/lib/probe";
import { findCompany, pappersEnabled } from "@/lib/pappers";
import { findContact } from "@/lib/contact-finder";

const RECENT_YEARS = 3;

/**
 * Chaîne d'enrichissement d'un lead, en une seule invocation : sonde du
 * site, données légales, recherche d'adresse, puis scoring.
 *
 * Tout est séquentiel et borné en temps — l'ensemble doit tenir dans les
 * 60 s d'une fonction Vercel. Chaque étape échoue en silence plutôt que
 * de faire tomber les suivantes : un lead à moitié enrichi reste
 * utilisable, un lead perdu ne l'est pas.
 */
export async function enrichLead({ leadId }: { leadId: string }): Promise<void> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return;

  const signals = await probeWebsite(lead.website);
  await saveSignals(leadId, [...signals, ...reviewSignals(lead.reviewCount)]);

  if (pappersEnabled() && !lead.siren) {
    await enrichFromPappers(leadId, lead.companyName, lead.postalCode);
  }

  if (!lead.email && lead.website) {
    const contact = await findContact(lead.website);
    if (contact.email || contact.contactFormUrl) {
      await db
        .update(leads)
        .set({
          email: contact.email ?? undefined,
          contactFormUrl: contact.contactFormUrl ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId));
    }
  }

  await scoreLead(leadId);
}

/* ------------------------------------------------------------------ */

async function saveSignals(
  leadId: string,
  signals: { kind: string; label: string; weight: number }[],
): Promise<void> {
  for (const signal of signals) {
    await db
      .insert(leadSignals)
      .values({ leadId, ...signal })
      .onConflictDoUpdate({
        target: [leadSignals.leadId, leadSignals.kind],
        set: { label: signal.label, weight: signal.weight, detectedAt: new Date() },
      });
  }
}

async function enrichFromPappers(
  leadId: string,
  companyName: string,
  postalCode: string | null,
): Promise<void> {
  let company;
  try {
    company = await findCompany(companyName, postalCode);
  } catch {
    return; // Pappers indisponible : on continue sans les données légales.
  }
  if (!company) return;

  if (company.headcount && company.headcount >= 5) {
    await db
      .insert(leadSignals)
      .values({
        leadId,
        kind: "headcount",
        label: `${company.headcount} salariés`,
        weight: 15,
      })
      .onConflictDoUpdate({
        target: [leadSignals.leadId, leadSignals.kind],
        set: { label: `${company.headcount} salariés`, weight: 15, detectedAt: new Date() },
      });
  }

  await db
    .update(leads)
    .set({
      siren: company.siren,
      naf: company.naf,
      headcount: company.headcount,
      revenue: company.revenue,
      incorporatedAt: company.incorporatedAt,
      contactName: company.directorName,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));

  if (!company.incorporatedAt) return;

  const years = (Date.now() - company.incorporatedAt.getTime()) / (365 * 86_400_000);
  if (years > RECENT_YEARS) return;

  await db
    .insert(leadSignals)
    .values({
      leadId,
      kind: "recent_company",
      label: `entreprise créée il y a moins de ${RECENT_YEARS} ans`,
      weight: 10,
    })
    .onConflictDoNothing();
}

/**
 * Le poids d'un établissement, lu dans ses avis Google.
 *
 * C'est la donnée la plus utile que Places renvoie, et elle était
 * facturée puis jetée. Un cabinet à 180 avis avec un site daté est un
 * client ; le même sans site à 2 avis est probablement une coquille.
 */
function reviewSignals(reviewCount: number | null): Signal[] {
  if (reviewCount === null) return [];

  if (reviewCount >= 100) {
    return [
      { kind: "reviews_many", label: `${reviewCount} avis Google`, weight: 25 },
    ];
  }
  if (reviewCount >= 30) {
    return [{ kind: "reviews_some", label: `${reviewCount} avis Google`, weight: 15 }];
  }
  if (reviewCount < 5) {
    return [
      {
        kind: "reviews_few",
        label: `seulement ${reviewCount} avis Google`,
        weight: -10,
      },
    ];
  }
  return [];
}

/**
 * Les signaux qui parlent du prospect, non de son site.
 *
 * La distinction ne vit qu'ici, dans le code : elle relève du modèle
 * commercial, pas de la donnée. Ajouter une colonne à `lead_signals`
 * aurait figé en base une décision qu'on veut pouvoir revoir.
 */
const VALUE_KINDS = new Set([
  "reviews_many",
  "reviews_some",
  "reviews_few",
  "headcount",
  "recent_company",
]);

/**
 * Score déterministe, en deux axes.
 *
 * `besoin` additionne ce qui cloche sur le site — c'est lui qui fournit
 * l'angle du message. `valeur` additionne ce que pèse le prospect. Le
 * total sert au tri et au seuil, mais les deux composantes restent
 * lisibles : « 65 » ne dit pas s'il s'agit d'un gros cabinet au site
 * correct ou d'une petite structure sans rien du tout.
 *
 * Volontairement sans IA : reproductible, débuggable et gratuit. L'IA
 * intervient plus tard, pour rédiger à partir de ces mêmes signaux.
 */
export async function scoreLead(leadId: string): Promise<void> {
  const signals = await db
    .select()
    .from(leadSignals)
    .where(eq(leadSignals.leadId, leadId));

  let need = 0;
  let value = 0;
  for (const signal of signals) {
    if (VALUE_KINDS.has(signal.kind)) value += signal.weight;
    else need += signal.weight;
  }

  const score = Math.max(0, Math.min(100, need + value));

  // Les motifs les plus lourds d'abord : c'est le premier que Claude
  // reprendra en accroche, autant que ce soit le plus parlant.
  const labels = signals
    .filter((signal) => signal.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((signal) => signal.label);

  await db
    .update(leads)
    .set({
      needScore: Math.max(0, need),
      valueScore: value,
      score,
      scoreRationale: labels.join(" · ") || "aucun signal exploitable",
      scoredAt: new Date(),
      enrichedAt: new Date(),
      status: "scored",
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));
}
