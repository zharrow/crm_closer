import { eq } from "drizzle-orm";
import { db, leadSignals, leads } from "@/db/client";
import { probeWebsite } from "@/lib/probe";
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
  await saveSignals(leadId, signals);

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
      weight: 20,
    })
    .onConflictDoNothing();
}

/**
 * Score déterministe = somme des poids des signaux, bornée à 100.
 * Volontairement sans IA : reproductible, débuggable et gratuit. L'IA
 * intervient plus tard, pour rédiger à partir de ces mêmes signaux.
 */
export async function scoreLead(leadId: string): Promise<void> {
  const signals = await db
    .select()
    .from(leadSignals)
    .where(eq(leadSignals.leadId, leadId));

  const total = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.max(0, Math.min(100, total));
  const labels = signals.filter((s) => s.weight > 0).map((s) => s.label);

  await db
    .update(leads)
    .set({
      score,
      scoreRationale: labels.join(" · ") || "aucun signal exploitable",
      scoredAt: new Date(),
      enrichedAt: new Date(),
      status: "scored",
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));
}
