/**
 * Un gabarit n'est pas un texte à trous — ce serait du publipostage.
 *
 * C'est une structure fixe dont seules trois fentes sont confiées au
 * modèle. La formule d'appel, la signature et les mentions légales sont
 * du code : constantes d'un message à l'autre, non facturées en tokens,
 * et impossibles à dériver. Les garde-fous n'ont donc à inspecter que
 * les fentes.
 */

export type SlotName = "hook" | "bridge" | "ask";
export type ChannelKey = "email" | "linkedin" | "phone" | "contact_form";

export interface TemplateContext {
  companyName: string;
  contactName?: string | null;
  senderFirstName: string;
  senderIdentity: string;
  bookingUrl: string;
  unsubscribeUrl?: string | null;
}

export interface Template {
  key: string;
  label: string;
  slots: Record<SlotName, string>;
  subject: (ctx: TemplateContext) => string;
}

const firstTouch: Template = {
  key: "first_touch",
  label: "Premier contact",
  slots: {
    hook: "Une phrase énonçant le constat le plus fort sur l'entreprise, factuel et vérifiable. Pas de compliment, pas de question rhétorique.",
    bridge:
      "Une à deux phrases reliant ce constat à une conséquence concrète pour leur activité. Pas de solution proposée, pas de vocabulaire technique.",
    ask: "Une question fermée et courte demandant si le sujet mérite un échange. Pas de proposition de créneau à ce stade.",
  },
  subject: (ctx) => `${ctx.companyName} — un point rapide`,
};

const followUp: Template = {
  key: "follow_up",
  label: "Relance",
  slots: {
    hook: "Une phrase rappelant le message précédent sans s'excuser d'insister et sans le résumer.",
    bridge:
      "Un angle différent du premier message : un autre constat, ou une conséquence non évoquée. Deux phrases maximum.",
    ask: "Une question fermée proposant un échange de vingt minutes.",
  },
  subject: (ctx) => `Re: ${ctx.companyName} — un point rapide`,
};

const breakUp: Template = {
  key: "break_up",
  label: "Dernier message",
  slots: {
    hook: "Une phrase indiquant que c'est le dernier message, sans reproche ni ironie.",
    bridge: "Une phrase laissant la porte ouverte sans conditionner quoi que ce soit.",
    ask: "Aucune question. Une phrase de clôture neutre.",
  },
  subject: (ctx) => `Re: ${ctx.companyName} — un point rapide`,
};

const TEMPLATES: Record<string, Template> = {
  [firstTouch.key]: firstTouch,
  [followUp.key]: followUp,
  [breakUp.key]: breakUp,
};

export function getTemplate(key: string | null | undefined): Template {
  return (key && TEMPLATES[key]) || firstTouch;
}

export const TEMPLATE_LIST = Object.values(TEMPLATES);

/* ------------------------------------------------------------------ */
/* Assemblage                                                          */
/* ------------------------------------------------------------------ */

function greeting(ctx: TemplateContext): string {
  return ctx.contactName ? `Bonjour ${ctx.contactName},` : "Bonjour,";
}

/**
 * Mentions obligatoires en prospection B2B : identité complète de
 * l'expéditeur et moyen d'opposition simple et gratuit. Elles sont
 * ajoutées ici, pas laissées à la discrétion du modèle — l'obligation ne
 * doit pas dépendre du respect d'une consigne de prompt.
 */
function emailFooter(ctx: TemplateContext): string[] {
  const lines = ["", "—"];
  if (ctx.senderIdentity) lines.push(ctx.senderIdentity);
  if (ctx.unsubscribeUrl) {
    lines.push(`Ne plus recevoir de messages : ${ctx.unsubscribeUrl}`);
  }
  return lines;
}

export function assemble(
  channel: ChannelKey,
  slots: Record<SlotName, string>,
  ctx: TemplateContext,
): string {
  if (channel === "linkedin") {
    // Pas de signature : le destinataire voit déjà ton profil.
    return [slots.hook, "", slots.bridge, "", slots.ask].join("\n").trim();
  }

  if (channel === "phone") {
    return [
      `Appel — ${ctx.companyName}`,
      "",
      `Accroche : ${slots.hook}`,
      `Enchaînement : ${slots.bridge}`,
      `Question : ${slots.ask}`,
      "",
      ctx.bookingUrl ? `Si intéressé, envoyer le lien : ${ctx.bookingUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    greeting(ctx),
    "",
    slots.hook,
    "",
    slots.bridge,
    "",
    slots.ask,
    "",
    ctx.senderFirstName,
    ...emailFooter(ctx),
  ].join("\n");
}

export const CHANNEL_LABEL: Record<ChannelKey, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  phone: "Téléphone",
  contact_form: "Formulaire",
};
