import { eq } from "drizzle-orm";
import { db, aiRuns, leadSignals, type Lead, type Settings } from "@/db/client";
import { completeStructured } from "./anthropic";
import { checkStyle, correctionHint, normalizeTypography } from "./style";
import { copyFor, enjeuFor } from "./signal-copy";
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
    "Cette description dit ce qu'il sait faire, pas ce qu'il faut annoncer.",
    "Retiens au plus une capacité, celle qui répond au constat que tu as",
    "choisi. N'énumère jamais son catalogue, et ne mentionne pas une",
    "compétence que rien dans le constat n'appelle.",
    "",
    "Les problèmes qu'il résout :",
    settings.painPoints || "(non renseigné)",
    "",
    "Ce qu'il a déjà livré, du même monde que le prospect :",
    settings.proofPoints || "(non renseigné)",
    "Tu peux t'appuyer sur une seule de ces réalisations, en une incise",
    "courte, et uniquement si elle parle au prospect. Jamais deux, jamais",
    "une que tu inventes, jamais de nom de client absent de cette liste.",
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
    "Chaque constat est accompagné de ce que l'expéditeur peut apporter.",
    "Appuie-toi dessus pour que le message ouvre sur une suite concrète",
    "au lieu de s'arrêter au diagnostic — sans rien chiffrer et sans",
    "détailler la technique. Un constat, ce qu'il implique pour le",
    "prospect, ce qu'on peut y faire.",
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
  signals: LoadedSignal[],
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
    "Constats exploitables, du plus fort au plus faible.",
    "Chacun porte ce qu'il coûte au destinataire, puis ce que l'expéditeur",
    "peut apporter pour y répondre :",
    signals.length > 0
      ? signals
          .map((signal) => {
            const copy = copyFor(signal.kind);
            if (!copy) return `- ${signal.label}`;
            /* L'enjeu passe par `enjeuFor` et non par `copy.enjeu` : certains
               sont juridiques et ne valent qu'au-dessus d'un effectif. Le
               modèle ne doit jamais recevoir un argument de droit qui ne
               s'applique pas à ce prospect — il s'en servirait. */
            const enjeu = enjeuFor(signal.kind, lead.headcount ?? null);
            return [
              `- ${signal.label}`,
              enjeu && `  ce que ça lui coûte : ${enjeu}`,
              `  → il peut apporter : ${copy.geste}`,
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n")
      : "- aucun",
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

    body = normalizeTypography(assemble(channel, data, ctx));

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

interface LoadedSignal {
  kind: string;
  label: string;
  weight: number;
}

async function loadSignals(leadId: string): Promise<LoadedSignal[]> {
  const rows = await db
    .select({ kind: leadSignals.kind, label: leadSignals.label, weight: leadSignals.weight })
    .from(leadSignals)
    .where(eq(leadSignals.leadId, leadId));

  // Le plus lourd d'abord : c'est celui que la rédaction prendra en
  // accroche, et l'ordre d'insertion en base n'a aucun sens éditorial.
  return rows.filter((row) => row.weight > 0).sort((a, b) => b.weight - a.weight);
}
