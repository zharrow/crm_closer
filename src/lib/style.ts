/**
 * Contrôle de style déterministe.
 *
 * Une seconde passe « humanisation » par le modèle coûterait un appel par
 * message et dégrade le texte plus souvent qu'elle ne l'améliore. Un
 * linter fait mieux : gratuit, reproductible, et la liste des interdits
 * est sous ton contrôle plutôt que dans les poids d'un réseau. Ajoute-y
 * ce que tu vois passer et que tu n'aimes pas.
 */

interface StyleRule {
  pattern: RegExp;
  label: string;
}

const BANNED: StyleRule[] = [
  { pattern: /j'esp[èe]re que (vous allez bien|ce message vous trouve)/i, label: "ouverture creuse" },
  { pattern: /\ben tant qu(e|')\s*(expert|sp[ée]cialiste|professionnel)/i, label: "auto-promotion" },
  { pattern: /\bn'h[ée]sitez pas [àa]\b/i, label: "formule passe-partout" },
  { pattern: /\bje me permets de\b/i, label: "précaution inutile" },
  { pattern: /\b(solution|approche) (sur[- ]mesure|clé en main|innovante)\b/i, label: "jargon commercial" },
  { pattern: /\b(booster|optimiser|maximiser) (votre|vos)\b/i, label: "verbe marketing" },
  { pattern: /\bdans le monde (d'aujourd'hui|actuel|numérique)\b/i, label: "généralité" },
  { pattern: /\bà l'[èe]re (du|de la|des)\b/i, label: "généralité" },
  { pattern: /\bincontournable\b|\bcrucial\b|\bessentiel de\b/i, label: "superlatif" },
  { pattern: /\bje serais ravi\b|\bce serait un plaisir\b/i, label: "politesse mécanique" },
  { pattern: /\bnotre équipe\b/i, label: "pluriel factice" },
  { pattern: /—/, label: "tiret cadratin" },
  { pattern: /\b(premi[èe]rement|deuxi[èe]mement|enfin,)\b/i, label: "énumération scolaire" },
  { pattern: /\bj'ai remarqué que\b/i, label: "accroche éculée" },
  { pattern: /\bopportunité\b/i, label: "mot creux" },
];

const MAX_WORDS = 130;
const MAX_SENTENCE_WORDS = 30;
const MIN_STDDEV = 3;

export interface StyleReport {
  ok: boolean;
  problems: string[];
}

export function checkStyle(text: string): StyleReport {
  const problems = [
    ...bannedPhrases(text),
    ...lengthProblems(text),
    ...uniformityProblem(text),
  ];

  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

/** Consigne de correction injectée lors d'une nouvelle tentative. */
export function correctionHint(report: StyleReport): string {
  return [
    "Le brouillon précédent a été rejeté pour :",
    ...report.problems.map((p) => `- ${p}`),
    "Réécris en corrigeant ces points. Ne conserve aucune des formules signalées.",
  ].join("\n");
}

/* ------------------------------------------------------------------ */

function bannedPhrases(text: string): string[] {
  return BANNED.filter((rule) => rule.pattern.test(text)).map((r) => r.label);
}

function lengthProblems(text: string): string[] {
  const problems: string[] = [];
  const total = words(text).length;

  if (total > MAX_WORDS) {
    problems.push(`texte trop long (${total} mots, maximum ${MAX_WORDS})`);
  }

  const longest = sentences(text).reduce((max, s) => Math.max(max, words(s).length), 0);
  if (longest > MAX_SENTENCE_WORDS) {
    problems.push(`phrase de ${longest} mots, à scinder`);
  }

  return problems;
}

/**
 * Des phrases toutes de même longueur produisent un rythme plat, très
 * reconnaissable. On exige un minimum de variance.
 */
function uniformityProblem(text: string): string[] {
  const lengths = sentences(text).map((s) => words(s).length);
  if (lengths.length < 3) return [];

  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / lengths.length;

  return Math.sqrt(variance) < MIN_STDDEV ? ["phrases de longueur trop uniforme"] : [];
}

function sentences(text: string): string[] {
  return text
    .split(/[.!?]+\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
