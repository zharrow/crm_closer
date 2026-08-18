import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jeton de désinscription auto-porteur : pas de table de correspondance à
 * maintenir, et impossible à forger pour désinscrire un tiers.
 *
 * L'envoi est manuel, mais le lien reste obligatoire : la prospection B2B
 * impose un moyen d'opposition simple et gratuit, et c'est lui qui
 * alimente la liste d'exclusion.
 */

function secret(): string {
  const value = process.env.UNSUBSCRIBE_SECRET;
  if (!value) throw new Error("UNSUBSCRIBE_SECRET manquant");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function unsubscribeToken(leadId: string): string {
  return `${leadId}.${sign(leadId)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [leadId, signature] = token.split(".");
  if (!leadId || !signature) return null;

  const expected = Buffer.from(sign(leadId));
  const received = Buffer.from(signature);

  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  return leadId;
}

export function unsubscribeUrl(leadId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL manquant");
  return `${base.replace(/\/$/, "")}/u/${unsubscribeToken(leadId)}`;
}
