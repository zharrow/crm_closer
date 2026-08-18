/**
 * Récupération de l'adresse de contact depuis le site de l'entreprise.
 *
 * Aucune API payante : ce sont des coordonnées que l'entreprise publie
 * elle-même. En France la page de mentions légales est obligatoire et
 * doit comporter un moyen de contact — c'est la source la plus fiable
 * quand la page d'accueil n'affiche rien.
 */

const PATHS = ["/contact", "/mentions-legales", "/nous-contacter"];
const TIMEOUT_MS = 5000;

/** Adresses techniques à ignorer : elles ne mènent à personne. */
const NOISE = [
  "noreply",
  "no-reply",
  "sentry",
  "wixpress",
  "example.com",
  "domain.com",
  "votre-email",
  "@2x",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
];

/** Préfixes génériques : sans caractère personnel, donc à privilégier. */
const PREFERRED = ["contact", "info", "bonjour", "hello", "commercial", "direction"];

export interface ContactInfo {
  email: string | null;
  contactFormUrl: string | null;
}

export async function findContact(website: string | null): Promise<ContactInfo> {
  if (!website) return { email: null, contactFormUrl: null };

  const origin = safeOrigin(website);
  if (!origin) return { email: null, contactFormUrl: null };

  let contactFormUrl: string | null = null;

  for (const url of [origin, ...PATHS.map((path) => `${origin}${path}`)]) {
    const html = await fetchText(url);
    if (!html) continue;

    const email = pickBest(extractEmails(html));
    if (email) return { email, contactFormUrl };

    if (!contactFormUrl && hasForm(html)) contactFormUrl = url;
  }

  return { email: null, contactFormUrl };
}

/* ------------------------------------------------------------------ */

function safeOrigin(website: string): string | null {
  try {
    return new URL(website).origin;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProspectBot/1.0)" },
    });

    return response.ok ? (await response.text()).slice(0, 300_000) : null;
  } catch {
    return null;
  }
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g;

function extractEmails(html: string): string[] {
  const found = html.match(EMAIL_PATTERN) ?? [];

  return [...new Set(found.map((e) => e.toLowerCase()))].filter(
    (email) => !NOISE.some((noise) => email.includes(noise)),
  );
}

/**
 * Une adresse générique est préférable : moins de données personnelles
 * collectées, et c'est celle que l'entreprise destine au public.
 */
function pickBest(emails: string[]): string | null {
  if (emails.length === 0) return null;

  const preferred = emails.find((email) =>
    PREFERRED.some((prefix) => email.startsWith(`${prefix}@`)),
  );

  return preferred ?? emails[0]!;
}

function hasForm(html: string): boolean {
  return /<form[^>]*>[\s\S]{0,4000}?type=["']email["']/i.test(html);
}
