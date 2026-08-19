/**
 * Traduire ce qui a raté, comme le fait déjà `(app)/error.tsx`.
 *
 * `tasks.error` est une colonne : elle garde ce qui s'est passé à la dernière
 * rédaction, parfois il y a plusieurs jours. Elle était affichée telle quelle,
 * ce qui produisait deux malentendus.
 *
 * D'abord le temps : « NEXT_PUBLIC_APP_URL manquant » se lit comme un constat
 * du moment, alors que c'est un souvenir. On corrige la variable, on recharge,
 * le message reste — et on cherche un problème qui n'existe plus. Le titre dit
 * donc « dernière rédaction », au passé.
 *
 * Ensuite le registre : la même colonne porte un avertissement sur le
 * brouillon affiché (« À relire »), un état du prospect (« lead exclu ») et
 * une panne technique. Trois choses qui n'appellent pas le même geste et qui
 * s'affichaient dans le même encadré ocre.
 *
 * Enfin le brut : une erreur d'API arrivait sous forme de JSON entier dans la
 * carte. `error.tsx` avait déjà tranché — on nomme la cause et le geste, on
 * range le détail technique dessous — mais la file n'en profitait pas.
 */
export type TaskNotice =
  /** Le brouillon est là et lisible, mais quelque chose mérite un œil. */
  | { kind: "avertissement"; title: string; detail: string | null }
  /** L'état du prospect ou de l'étape, pas une panne. */
  | { kind: "etat"; title: string; detail: string | null }
  /** La rédaction précédente a échoué. Relancer est le geste. */
  | { kind: "echec"; title: string; hint: string; raw: string | null };

/** Le motif, et ce qu'il faut faire — pas la trace d'exécution. */
const FAILURES: { match: RegExp; title: string; hint: string }[] = [
  {
    match: /credit balance is too low/i,
    title: "Crédit Anthropic épuisé",
    hint: "Recharge ton compte sur console.anthropic.com, puis relance la rédaction. Rien n'est perdu : l'action est toujours dans ta file.",
  },
  {
    match: /NEXT_PUBLIC_APP_URL/,
    title: "Adresse de l'app non configurée",
    hint: "NEXT_PUBLIC_APP_URL était absente au moment de cette rédaction — elle sert à fabriquer le lien de désinscription. Si elle est renseignée depuis, relance la rédaction : le message se réécrira sans erreur.",
  },
  {
    match: /rate_limit|429/i,
    title: "Trop de rédactions d'affilée",
    hint: "L'API a demandé une pause. Réessaie dans une minute.",
  },
  {
    match: /overloaded|529/i,
    title: "L'API Anthropic est saturée",
    hint: "Ça vient de chez eux, pas de ta configuration. Réessaie dans quelques minutes.",
  },
  {
    match: /ANTHROPIC_API_KEY/,
    title: "Clé Anthropic absente",
    hint: "Ajoute ANTHROPIC_API_KEY dans tes variables d'environnement, puis relance la rédaction.",
  },
  {
    match: /timeout|ETIMEDOUT|ECONNRESET/i,
    title: "L'API n'a pas répondu à temps",
    hint: "Une coupure passagère. Relance la rédaction.",
  },
];

const STATES: { match: RegExp; title: string }[] = [
  { match: /liste d'exclusion|lead exclu/i, title: "Prospect en liste d'exclusion" },
  { match: /aucune adresse email connue/i, title: "Aucune adresse email connue" },
  { match: /ignorée manuellement/i, title: "Étape passée à la main" },
];

export function readTaskError(raw: string): TaskNotice {
  const text = raw.trim();

  // Le linter de style a laissé passer le brouillon en le signalant : c'est
  // un avertissement sur le texte affiché juste dessous, pas une panne.
  if (/^À relire\s*:/i.test(text)) {
    return {
      kind: "avertissement",
      title: "À relire avant d'envoyer",
      detail: text.replace(/^À relire\s*:\s*/i, "") || null,
    };
  }

  for (const { match, title } of STATES) {
    if (match.test(text)) return { kind: "etat", title, detail: null };
  }

  for (const { match, title, hint } of FAILURES) {
    if (match.test(text)) return { kind: "echec", title, hint, raw: text };
  }

  return {
    kind: "echec",
    title: "La dernière rédaction a échoué",
    hint: "Le détail technique est ci-dessous. Relancer la rédaction suffit le plus souvent.",
    raw: text,
  };
}
