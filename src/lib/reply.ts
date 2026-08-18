import { asc, eq } from "drizzle-orm";
import { db, aiRuns, conversations, leadSignals, leads, messages } from "@/db/client";
import { completeStructured } from "./anthropic";
import { inspectDraft } from "./guardrails";
import { getSettings } from "./settings";

const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Le corps de la réponse proposée." },
    reasoning: {
      type: "string",
      description: "Une phrase expliquant l'angle choisi, pour toi, pas pour le prospect.",
    },
    escalate: {
      type: "boolean",
      description: "true si la demande sort du cadre et mérite que tu répondes toi-même.",
    },
  },
  required: ["reply", "reasoning", "escalate"],
  additionalProperties: false,
} as const;

export interface ReplySuggestion {
  reply: string;
  reasoning: string;
  escalate: boolean;
  warnings: string[];
}

/**
 * Propose une réponse à un prospect qui a répondu.
 *
 * Le modèle a un objectif unique : obtenir un rendez-vous de vingt
 * minutes. Il ne négocie pas, ne chiffre rien, et signale lui-même les
 * cas qui te reviennent. Les mêmes garde-fous mécaniques que pour la
 * prospection s'appliquent au brouillon produit — un prix qui passe le
 * prompt ne passe pas la regex.
 */
export async function suggestReply(leadId: string): Promise<ReplySuggestion> {
  const settings = await getSettings();
  const started = Date.now();

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead introuvable");

  const system = [
    `Tu assistes ${settings.senderFirstName || "un indépendant"} dans ses échanges`,
    "de prospection B2B. Tu écris en français, en vouvoyant, de façon sobre.",
    "",
    "Ce qu'il propose :",
    settings.offer || "(non renseigné)",
    "",
    "Ton unique objectif est d'obtenir un rendez-vous de vingt minutes.",
    "Tu ne vends rien par écrit.",
    "",
    "Interdictions absolues, sans exception :",
    "- Aucun prix, aucun tarif, aucune fourchette budgétaire.",
    "- Aucun délai, aucune durée de réalisation, aucune date de livraison.",
    "- Aucun périmètre technique détaillé ni engagement contractuel.",
    "Si le prospect demande l'un de ces éléments, tu n'improvises pas :",
    "tu mets `escalate` à true et tu proposes une réponse qui renvoie la",
    "question à l'échange de vive voix.",
    "",
    "Tu mets également `escalate` à true si le prospect est hostile, si sa",
    "demande sort du champ, ou si tu n'es pas certain de la bonne réponse.",
    "",
    settings.bookingUrl
      ? `Pour proposer un créneau, insère ce lien tel quel : ${settings.bookingUrl}`
      : "Aucun lien de réservation n'est configuré : propose un échange sans lien.",
    "",
    "Style : phrases courtes de longueurs variées, vocabulaire concret,",
    "pas de superlatif, pas de jargon commercial, pas de tiret cadratin.",
    "120 mots maximum.",
  ].join("\n");

  const [signals, history] = await Promise.all([
    db.select({ label: leadSignals.label }).from(leadSignals).where(eq(leadSignals.leadId, leadId)),
    loadHistory(leadId),
  ]);

  const prompt = [
    "Contexte du prospect :",
    `Entreprise : ${lead.companyName}`,
    lead.city && `Ville : ${lead.city}`,
    lead.website ? `Site : ${lead.website}` : "Site : aucun",
    signals.length > 0 && `Constats : ${signals.map((s) => s.label).join(", ")}`,
    "",
    "Historique de l'échange, du plus ancien au plus récent :",
    history || "(aucun message enregistré)",
    "",
    "Rédige la réponse.",
  ]
    .filter(Boolean)
    .join("\n");

  const { data, usage } = await completeStructured<{
    reply: string;
    reasoning: string;
    escalate: boolean;
  }>({
    model: settings.draftModel,
    system,
    prompt,
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
  });

  const { safe, violations } = inspectDraft(data.reply);

  await db.insert(aiRuns).values({
    leadId,
    kind: "reply",
    model: settings.draftModel,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedTokens: usage.cachedTokens,
    latencyMs: Date.now() - started,
    rejections: safe ? null : violations,
  });

  return {
    reply: data.reply,
    reasoning: data.reasoning,
    // Un brouillon qui déclenche les garde-fous te revient, quoi qu'ait
    // décidé le modèle.
    escalate: data.escalate || !safe,
    warnings: safe ? [] : violations,
  };
}

async function loadHistory(leadId: string): Promise<string> {
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .limit(1);

  if (!conversation) return "";

  const rows = await db
    .select({ role: messages.role, body: messages.body })
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.createdAt))
    .limit(20);

  const speaker: Record<string, string> = {
    us: "NOUS",
    prospect: "PROSPECT",
    draft: "BROUILLON NON ENVOYÉ",
  };

  return rows.map((row) => `[${speaker[row.role] ?? row.role}] ${row.body}`).join("\n\n");
}
