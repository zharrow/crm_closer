export interface Signal {
  kind: string;
  label: string;
  weight: number;
}

const TIMEOUT_MS = 5000;
const SLOW_MS = 3000;

/**
 * Les signaux viennent du site lui-même, pas d'une API payante. Ce sont
 * eux qui rendent la personnalisation crédible : un constat vérifiable
 * vaut mieux que n'importe quelle formule d'accroche.
 *
 * Les délais sont serrés volontairement — sur Vercel la fonction est
 * bornée à 60 s, et une sonde qui traîne fait tomber tout le lot.
 */
export async function probeWebsite(url: string | null): Promise<Signal[]> {
  if (!url) {
    return [{ kind: "no_website", label: "aucun site web référencé", weight: 40 }];
  }

  const platform = platformOnly(url);
  if (platform) {
    return [
      {
        kind: "social_only",
        label: `pas de site propre, seulement une fiche ${platform}`,
        weight: 35,
      },
    ];
  }

  try {
    return await inspect(url);
  } catch (error) {
    return [unreachable(error)];
  }
}

/* ------------------------------------------------------------------ */

/**
 * Domaines qui ne sont pas le site du prospect, mais sa fiche chez
 * quelqu'un d'autre : réseaux sociaux, annuaires, plateformes de
 * rendez-vous.
 *
 * Les sonder n'a aucun sens — on inspecterait la page d'un tiers et on
 * lui reprocherait ses défauts. Un cabinet dont l'unique présence est une
 * fiche Maiia n'a pas « un formulaire de contact manquant » : il n'a pas
 * de site du tout, ce qui est un bien meilleur angle commercial.
 */
const PLATFORM_HOSTS: [string, string][] = [
  ["facebook.com", "Facebook"],
  ["instagram.com", "Instagram"],
  ["linkedin.com", "LinkedIn"],
  ["pagesjaunes.fr", "Pages Jaunes"],
  ["doctolib.fr", "Doctolib"],
  ["maiia.com", "Maiia"],
  ["keldoc.com", "KelDoc"],
  ["mondocteur.fr", "MonDocteur"],
  ["docavenue.com", "Docavenue"],
  ["clicrdv.com", "ClicRDV"],
  ["planity.com", "Planity"],
  ["resalib.fr", "Resalib"],
  ["treatwell.fr", "Treatwell"],
  ["booksy.com", "Booksy"],
  ["fresha.com", "Fresha"],
  ["linktr.ee", "Linktree"],
  ["google.com/maps", "Google Maps"],
];

function platformOnly(url: string): string | null {
  const lower = url.toLowerCase();
  const hit = PLATFORM_HOSTS.find(([host]) => lower.includes(host));
  return hit ? hit[1] : null;
}

async function inspect(url: string): Promise<Signal[]> {
  const signals: Signal[] = [];
  const started = Date.now();

  const response = await fetchWithTimeout(url);
  const elapsed = Date.now() - started;
  const html = (await response.text()).slice(0, 200_000);

  if (!response.url.startsWith("https://")) {
    signals.push({ kind: "http_only", label: "site sans HTTPS", weight: 30 });
  }

  if (elapsed > SLOW_MS) {
    signals.push({
      kind: "slow",
      label: `page d'accueil chargée en ${(elapsed / 1000).toFixed(1)} s`,
      weight: 20,
    });
  }

  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    signals.push({ kind: "not_responsive", label: "site non adapté au mobile", weight: 25 });
  }

  const year = copyrightYear(html);
  if (year && year < new Date().getFullYear() - 2) {
    signals.push({
      kind: "stale",
      label: `mention de copyright figée en ${year}`,
      weight: 15,
    });
  }

  // Les quatre détections suivantes visent ce que tu vends réellement,
  // pas la conformité technique du site. Un kiné se moque du responsive ;
  // il perd une heure par jour à décrocher pour caler des rendez-vous.

  if (!hasOnlineBooking(html)) {
    signals.push({
      kind: "no_booking",
      label: "pas de prise de rendez-vous en ligne",
      weight: 30,
    });
  }

  if (!hasContactPath(html)) {
    signals.push({
      kind: "no_contact_path",
      label: "aucun formulaire ni page de contact",
      weight: 25,
    });
  }

  const builder = siteBuilder(html);
  if (builder) {
    signals.push({
      kind: "diy_builder",
      label: `site construit sur ${builder}`,
      weight: 20,
    });
  }

  if (!/mentions[-_\s]?l[ée]gales/i.test(html)) {
    // Obligation légale en France : l'absence est un constat vérifiable
    // et une entrée en matière difficile à contester.
    signals.push({
      kind: "no_legal",
      label: "pas de mentions légales",
      weight: 10,
    });
  }

  // Design et expérience. Rien d'esthétique ici : on ne peut pas juger un
  // goût sur du HTML brut. Ce sont des marqueurs objectifs de soin, tous
  // vérifiables par le prospect lui-même en trente secondes.

  if (/<frameset|<table[^>]+(?:width=["']100%|cellpadding)/i.test(html)) {
    signals.push({
      kind: "table_layout",
      label: "mise en page en tableaux, comme au début des années 2000",
      weight: 25,
    });
  }

  if (hasTracking(html) && !hasConsentBanner(html)) {
    signals.push({
      kind: "tracking_no_consent",
      label: "traceurs chargés sans bandeau de consentement",
      weight: 20,
    });
  }

  const words = visibleWordCount(html);
  if (words < 120) {
    signals.push({
      kind: "thin_content",
      label: `page d'accueil quasi vide (${words} mots)`,
      weight: 15,
    });
  }

  if (!/property=["']og:(?:title|image)["']/i.test(html)) {
    signals.push({
      kind: "no_og",
      label: "aperçu cassé quand le lien est partagé",
      weight: 10,
    });
  }

  if (!/@font-face|fonts\.(?:googleapis|gstatic|bunny)|typekit|font-family:\s*["']/i.test(html)) {
    signals.push({
      kind: "no_webfont",
      label: "typographie laissée aux réglages par défaut du navigateur",
      weight: 10,
    });
  }

  if (!/href=["']tel:/i.test(html)) {
    signals.push({
      kind: "phone_not_clickable",
      label: "numéro non cliquable sur mobile",
      weight: 10,
    });
  }

  signals.push(...accessibility(html));
  signals.push(...datedBuild(html));

  // Un site sain ne produit aucun signal : on en pose un neutre pour que
  // le lead soit tout de même scoré, plutôt que de rester bloqué en
  // « enrichi » indéfiniment faute de ligne dans lead_signals.
  if (signals.length === 0) {
    signals.push({ kind: "site_ok", label: "site en bon état", weight: 0 });
  }

  return signals;
}

/**
 * L'accessibilité, telle qu'elle se constate depuis l'extérieur.
 *
 * C'était le gisement le plus évident et le seul absent : ces défauts se
 * lisent dans le HTML, sans rien rendre, et ils touchent exactement ce que
 * l'expéditeur vend — la qualité de fabrication, pas la plomberie.
 *
 * On reste sur ce qui est **certain à la lecture du balisage**. Le contraste
 * réel d'un texte posé sur une photo ne s'en déduit pas : il demande de
 * peindre la page, et c'est le travail de la passe visuelle, pas d'ici. Une
 * regex qui prétendrait juger un contraste se tromperait, et un signal faux
 * coûte plus qu'un signal manquant : il part dans un email.
 *
 * Repère de comparaison : WebAIM relève des échecs WCAG détectés sur 95,9 %
 * des pages d'accueil du million de sites les plus visités (février 2026).
 * Ces défauts sont donc la règle, pas l'exception — ce qui en fait un angle
 * d'entrée, jamais un reproche.
 */
function accessibility(html: string): Signal[] {
  const signals: Signal[] = [];

  // Le zoom interdit : une ligne dans la balise viewport, et le texte ne
  // peut plus être agrandi. Le défaut le plus dur pour qui voit mal, et
  // l'un des plus faciles à constater.
  if (/<meta[^>]+name=["']viewport["'][^>]*(?:user-scalable\s*=\s*["']?no|maximum-scale\s*=\s*["']?1)/i.test(html)) {
    signals.push({
      kind: "no_zoom",
      label: "zoom désactivé sur mobile",
      weight: 20,
    });
  }

  // `lang` absent : un lecteur d'écran prononce le français avec les règles
  // de sa langue par défaut, et devient incompréhensible.
  if (!/<html[^>]+lang\s*=\s*["'][a-z]/i.test(html)) {
    signals.push({
      kind: "no_lang",
      label: "langue de la page non déclarée",
      weight: 10,
    });
  }

  // Images sans alternative textuelle. On compte plutôt que de signaler au
  // premier manquant : une image décorative sans `alt` est normale, dix
  // images sur douze sans `alt` est un défaut de fabrication.
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const withoutAlt = imgs.filter((tag) => !/\balt\s*=/i.test(tag)).length;
  if (imgs.length >= 4 && withoutAlt / imgs.length > 0.5) {
    signals.push({
      kind: "images_no_alt",
      label: `${withoutAlt} images sur ${imgs.length} sans texte alternatif`,
      weight: 15,
    });
  }

  // Champs de formulaire sans étiquette reliée. Même prudence : on ne
  // signale que si le formulaire existe et qu'aucun champ n'est étiqueté.
  const inputs = html.match(/<input\b[^>]*>/gi) ?? [];
  const real = inputs.filter((tag) => !/type\s*=\s*["'](?:hidden|submit|button|image)["']/i.test(tag));
  const labelled = /<label\b[^>]*\bfor\s*=/i.test(html) || /aria-label(?:ledby)?\s*=/i.test(html);
  if (real.length >= 2 && !labelled) {
    signals.push({
      kind: "inputs_no_label",
      label: "champs de formulaire sans étiquette",
      weight: 15,
    });
  }

  // Aucun titre de niveau 1 : la page n'annonce pas de quoi elle parle, ni
  // à un lecteur d'écran ni à un moteur.
  if (!/<h1\b/i.test(html)) {
    signals.push({
      kind: "no_h1",
      label: "page sans titre principal",
      weight: 10,
    });
  }

  return signals;
}

/**
 * Les indices de vétusté — et ce sont des **indices**, pas des preuves.
 *
 * On ne peut pas conclure « ce site est laid » d'une balise. Ce qu'on peut
 * établir, c'est qu'il repose sur des techniques abandonnées : une largeur
 * figée en pixels, une version de jQuery d'il y a dix ans, des balises de
 * présentation supprimées de HTML5. Chacun de ces indices date la
 * fabrication sans juger le résultat, et c'est la formulation honnête.
 *
 * Le jugement esthétique proprement dit demande de voir la page. Il ne se
 * fait pas ici.
 */
function datedBuild(html: string): Signal[] {
  const signals: Signal[] = [];

  // Balises de présentation retirées de HTML5, encore en usage.
  if (/<(?:center|font|marquee|blink)\b/i.test(html)) {
    signals.push({
      kind: "legacy_tags",
      label: "balises de présentation abandonnées depuis HTML5",
      weight: 20,
    });
  }

  // Largeur figée : la page ne peut pas s'adapter, quelle que soit la
  // balise viewport.
  if (/width\s*:\s*(?:9[0-9]{2}|1[0-9]{3})px/i.test(html)) {
    signals.push({
      kind: "fixed_width",
      label: "mise en page figée à une largeur d'écran",
      weight: 15,
    });
  }

  // jQuery 1.x/2.x : plus maintenu, et bon marqueur de l'âge du chantier.
  const jq = /jquery[.-](\d+)\.\d+(?:\.\d+)?(?:\.min)?\.js/i.exec(html);
  if (jq && Number(jq[1]) < 3) {
    signals.push({
      kind: "old_jquery",
      label: `bibliothèque jQuery ${jq[1]}.x, sans mise à jour depuis des années`,
      weight: 10,
    });
  }

  return signals;
}

/* ------------------------------------------------------------------ */

/**
 * Prestataires de rendez-vous en ligne courants en France, plus les
 * chemins d'un système maison. On ne conclut à l'absence que faute de
 * tout indice : mieux vaut rater un signal que d'écrire à un cabinet
 * qu'il n'a pas de prise de rendez-vous alors qu'il en a une.
 */
const BOOKING_MARKERS = [
  "doctolib",
  "maiia",
  "keldoc",
  "mondocteur",
  "docavenue",
  "planity",
  "calendly",
  "resalib",
  "treatwell",
  "fresha",
  "booksy",
  "clicrdv",
  "simplybook",
  "timify",
  "wecasa",
  "kiute",
  "agendize",
  "youplanning",
  "resamania",
  "/reservation",
  "/reserver",
  "/booking",
  "/prendre-rendez-vous",
  "/prise-de-rendez-vous",
  "/rdv",
];

function hasOnlineBooking(html: string): boolean {
  const lower = html.toLowerCase();
  return BOOKING_MARKERS.some((marker) => lower.includes(marker));
}

/** Un formulaire sur l'accueil, ou au moins un chemin vers un contact. */
function hasContactPath(html: string): boolean {
  if (/<form[^>]*>/i.test(html)) return true;
  return /href=["'][^"']*contact/i.test(html) || /href=["']mailto:/i.test(html);
}

const BUILDERS: [RegExp, string][] = [
  [/wix\.com|wixstatic/i, "Wix"],
  [/jimdo/i, "Jimdo"],
  [/weebly/i, "Weebly"],
  [/e-monsite/i, "e-monsite"],
  [/sitew/i, "SiteW"],
  [/webnode/i, "Webnode"],
  [/sites\.google\.com/i, "Google Sites"],
  [/solocal|pagesjaunes/i, "Pages Jaunes"],
  [/squarespace/i, "Squarespace"],
];

/**
 * Un éditeur grand public n'est pas un défaut en soi : c'est un signe
 * que personne n'a été payé pour ce site, donc qu'il n'y a pas de
 * prestataire en place à déloger.
 */
function siteBuilder(html: string): string | null {
  const head = html.slice(0, 40_000);
  for (const [pattern, name] of BUILDERS) {
    if (pattern.test(head)) return name;
  }
  return null;
}

const TRACKERS = /gtag\(|googletagmanager|google-analytics|fbq\(|connect\.facebook\.net|hotjar|matomo/i;
const CONSENT = /axeptio|tarteaucitron|cookiebot|didomi|orejime|cookieconsent|cookie-consent|klaro|osano/i;

function hasTracking(html: string): boolean {
  return TRACKERS.test(html);
}

function hasConsentBanner(html: string): boolean {
  return CONSENT.test(html);
}

/**
 * Compte grossier des mots visibles : on retire scripts, styles et
 * balises, puis on compte. Sert à repérer une page d'accueil qui ne dit
 * rien — le cas le plus fréquent chez un professionnel qui a « fait un
 * site » sans jamais écrire le contenu.
 */
function visibleWordCount(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ");

  return text.split(/\s+/).filter((word) => word.length > 1).length;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProspectBot/1.0)" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function copyrightYear(html: string): number | null {
  const match = /(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/i.exec(html);
  const year = match ? Number(match[1]) : null;

  return year && year > 1995 && year <= new Date().getFullYear() ? year : null;
}

function unreachable(error: unknown): Signal {
  const isTimeout = error instanceof Error && error.name === "AbortError";

  return {
    kind: "unreachable",
    label: isTimeout ? "site injoignable (délai dépassé)" : "site en erreur",
    weight: 35,
  };
}
