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

  if (isSocialOnly(url)) {
    return [
      {
        kind: "social_only",
        label: "présence limitée à une page de réseau social",
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

const SOCIAL_HOSTS = ["facebook.com", "instagram.com", "linkedin.com", "pagesjaunes.fr"];

function isSocialOnly(url: string): boolean {
  return SOCIAL_HOSTS.some((host) => url.includes(host));
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

  // Un site sain ne produit aucun signal : on en pose un neutre pour que
  // le lead soit tout de même scoré, plutôt que de rester bloqué en
  // « enrichi » indéfiniment faute de ligne dans lead_signals.
  if (signals.length === 0) {
    signals.push({ kind: "site_ok", label: "site en bon état", weight: 0 });
  }

  return signals;
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
