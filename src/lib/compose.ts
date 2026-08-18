import { eq } from "drizzle-orm";
import { db, aiRuns, leadSignals, type Lead, type Settings } from "@/db/client";
import { completeStructured } from "./anthropic";
import { checkStyle, correctionHint } from "./style";
import { inspectDraft } from "./guardrails";
import {
  assemble,
  getTemplate,
  type ChannelKey,
  type SlotName,
  type TemplateContext,
} from "./templates";
import { unsubscribeUrl } from "./unsubscribe";

const MAX_ATTEMPTS = 3;

const SLOT_SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string", description: "Contenu de la fente hook." },
    bridge: { type: "string", description: "Contenu de la fente bridge." },
    ask: { type: "string", description: "Contenu de la fente ask." },
  },
  required: ["hook", "bridge", "ask"],
  additionalProperties: false,
} as const;

export interface Draft {
  subject: string | null;
  body: string;
  /** Motifs de rejet des garde-fous, si le brouillon en déclenche. */
  warnings: string[];
}

/**
 * Le prompt système est identique d'un lead à l'autre : c'est lui qui
 * porte le marqueur de cache côté API. Tout ce qui varie (l'entreprise,
 * ses signaux) part dans le message utilisateur, après le point de cache.
 */
function buildSystem(settings: Settings, channel: ChannelKey): string {
  const channelRule =
    channel === "linkedin"
      ? "Le message part sur LinkedIn : pas de formule d'appel, pas de signature, deux à trois phrases maximum au total."
      : channel === "phone"
        ? "Ce sont des notes pour un appel téléphonique : style parlé, phrases courtes, rien qui ressemble à un script lu."
        : "Le message part par email. La formule d'appel, la signature et les mentions légales sont ajoutées par le code : ne les écris pas.";

  return [
    "Tu rédiges des fragments de messages de prospection B2B en français,",
    `pour ${settings.senderFirstName || "un indépendant"}.`,
    "",
    "Ce qu'il propose :",
    settings.offer || "(non renseigné)",
    "",
    "Les problèmes qu'il résout :",
    settings.painPoints || "(non renseigné)",
    "",
    "Tu ne produis pas un message complet : uniquement le contenu des",
    "fentes qu'on te demande. Chaque fente est un fragment autonome, sans",
    "titre ni préfixe.",
    "",
    channelRule,
    "",
    "Interdictions absolues, sans exception :",
    "- Aucun prix, aucun tarif, aucune fourchette budgétaire.",
    "- Aucun délai chiffré, aucune date de livraison.",
    "- Aucun engagement ferme, aucune remise, aucune prestation gratuite.",
    "- Aucun périmètre technique détaillé.",
    "Si le contexte semble appeler l'un de ces éléments, reste sur le",
    "constat et laisse la question ouverte.",
    "",
    "Style : vouvoiement, phrases courtes de longueurs variées,",
    "vocabulaire concret. Pas de superlatif, pas de jargon commercial,",
    "pas de tiret cadratin, pas de formule d'accroche éculée. Tu pars",
    "toujours d'un constat vérifiable sur l'entreprise, jamais d'un",
    "compliment ni d'une généralité sur le marché.",
  ].join("\n");
}

function buildPrompt(
  lead: Lead,
  signals: string[],
  slots: Record<SlotName, string>,
  brief: string,
  hint: string,
): string {
  const facts = [
    `Entreprise : ${lead.companyName}`,
    lead.city && `Ville : ${lead.city}`,
    lead.website ? `Site : ${lead.website}` : "Site : aucun site trouvé",
    lead.headcount && `Effectif : ${lead.headcount}`,
    lead.naf && `Code NAF : ${lead.naf}`,
  ].filter(Boolean);

  const spec = Object.entries(slots)
    .map(([name, instruction]) => `"${name}" : ${instruction}`)
    .join("\n");

  return [
    "Faits vérifiés :",
    facts.join("\n"),
    "",
    "Constats exploitables :",
    signals.length > 0 ? signals.map((s) => `- ${s}`).join("\n") : "- aucun",
    "",
    `Intention de cette étape : ${brief}`,
    "",
    "Fentes à remplir :",
    spec,
    hint && `\n${hint}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface DraftInput {
  lead: Lead;
  settings: Settings;
  channel: ChannelKey;
  templateKey: string | null;
  brief: string | null;
}

/**
 * Génère les fentes, assemble le corps de façon déterministe, puis
 * vérifie le style. Un brouillon rejeté est régénéré avec le motif du
 * rejet — deux fois au maximum, sinon on part avec la dernière version
 * en signalant le problème plutôt que de boucler indéfiniment.
 */
export async function draftMessage({
  lead,
  settings,
  channel,
  templateKey,
  brief,
}: DraftInput): Promise<Draft> {
  const template = getTemplate(templateKey);
  const signals = await loadSignals(lead.id);
  const started = Date.now();

  const ctx: TemplateContext = {
    companyName: lead.companyName,
    contactName: lead.contactName,
    senderFirstName: settings.senderFirstName,
    senderIdentity: settings.senderIdentity,
    bookingUrl: settings.bookingUrl,
    unsubscribeUrl: channel === "email" ? unsubscribeUrl(lead.id) : null,
  };

  const system = buildSystem(settings, channel);
  const effort = (settings.draftEffort as "low" | "medium" | "high") ?? "low";

  let hint = "";
  let body = "";
  let attempts = 0;
  const rejections: string[] = [];
  let totalUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    attempts = attempt + 1;

    const { data, usage } = await completeStructured<Record<SlotName, string>>({
      model: settings.draftModel,
      system,
      prompt: buildPrompt(lead, signals, template.slots, brief ?? "Premier contact.", hint),
      schema: SLOT_SCHEMA as unknown as Record<string, unknown>,
      effort,
    });

    totalUsage = {
      inputTokens: totalUsage.inputTokens + usage.inputTokens,
      outputTokens: totalUsage.outputTokens + usage.outputTokens,
      cachedTokens: totalUsage.cachedTokens + usage.cachedTokens,
    };

    body = assemble(channel, data, ctx);

    const report = checkStyle(body);
    if (report.ok) break;

    rejections.push(...report.problems);
    hint = correctionHint(report);
  }

  const { safe, violations } = inspectDraft(body);

  await db.insert(aiRuns).values({
    leadId: lead.id,
    kind: "draft",
    model: settings.draftModel,
    attempts,
    rejections: rejections.length > 0 ? [...new Set(rejections)] : null,
    inputTokens: totalUsage.inputTokens,
    outputTokens: totalUsage.outputTokens,
    cachedTokens: totalUsage.cachedTokens,
    latencyMs: Date.now() - started,
  });

  return {
    subject: channel === "email" ? template.subject(ctx) : null,
    body,
    warnings: safe ? [] : violations,
  };
}

async function loadSignals(leadId: string): Promise<string[]> {
  const rows = await db
    .select({ label: leadSignals.label })
    .from(leadSignals)
    .where(eq(leadSignals.leadId, leadId));

  return rows.map((row) => row.label);
}
