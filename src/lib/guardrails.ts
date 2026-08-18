/**
 * Filet de sécurité appliqué au brouillon après génération.
 *
 * Le prompt interdit déjà tout engagement chiffré, mais une consigne
 * n'est pas une garantie. Un modèle qui annonce « 3 500 € » sur un projet
 * à 12 000 € place son auteur dans une position commerciale intenable :
 * le contrôle est donc mécanique, pas déclaratif.
 *
 * Un brouillon qui échoue ici n'est pas envoyé tel quel — il est marqué
 * et t'est présenté avec le motif, à toi de trancher.
 */

interface Rule {
  pattern: RegExp;
  label: string;
}

const RULES: Rule[] = [
  { pattern: /\d[\d\s.,]*\s*(?:€|euros?|k€|EUR)\b/i, label: "montant chiffré" },
  { pattern: /\b(?:tarif|prix|devis|budget)\s+(?:de|à|est)\s+\d/i, label: "tarif annoncé" },
  {
    pattern: /\b\d+\s*(?:jours?|semaines?|mois)\s+(?:de\s+)?(?:travail|d[ée]veloppement|livraison)/i,
    label: "délai chiffré",
  },
  { pattern: /\b(?:je m'engage|nous nous engageons|garanti[es]?\s+(?:sous|en))\b/i, label: "engagement ferme" },
  { pattern: /\b(?:remise|réduction)\s+de\s+\d/i, label: "remise" },
  { pattern: /\b\d+\s*%\s*(?:de\s+)?(?:remise|réduction)/i, label: "remise" },
  { pattern: /\bgratuit(?:ement)?\b/i, label: "gratuité promise" },
];

export interface GuardrailResult {
  safe: boolean;
  violations: string[];
}

export function inspectDraft(text: string): GuardrailResult {
  const violations = RULES.filter((rule) => rule.pattern.test(text)).map((r) => r.label);
  return { safe: violations.length === 0, violations: [...new Set(violations)] };
}
