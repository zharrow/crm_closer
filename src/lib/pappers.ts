const SEARCH = "https://api.pappers.fr/v2/recherche";

/**
 * Pappers expose les données INPI en open data via une API officielle :
 * pas de scraping, pas de zone grise contractuelle, contrairement aux
 * annuaires qui l'interdisent dans leurs conditions.
 *
 * L'enrichissement est optionnel — sans clé, on saute simplement l'étape
 * plutôt que de faire échouer le sourcing.
 */
export interface CompanyRecord {
  siren: string;
  name: string;
  naf?: string;
  headcount?: number;
  revenue?: number;
  incorporatedAt?: Date;
  directorName?: string;
}

export function pappersEnabled(): boolean {
  return Boolean(process.env.PAPPERS_API_KEY);
}

export async function findCompany(
  name: string,
  postalCode?: string | null,
): Promise<CompanyRecord | null> {
  const token = process.env.PAPPERS_API_KEY;
  if (!token) return null;

  const url = new URL(SEARCH);
  url.searchParams.set("api_token", token);
  url.searchParams.set("q", name);
  url.searchParams.set("par_page", "1");
  if (postalCode) url.searchParams.set("code_postal", postalCode);

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Pappers ${response.status}`);

  const body = (await response.json()) as { resultats?: RawCompany[] };
  const first = body.resultats?.[0];

  return first ? toRecord(first) : null;
}

/* ------------------------------------------------------------------ */

interface RawCompany {
  siren: string;
  nom_entreprise?: string;
  code_naf?: string;
  effectif_min?: number;
  chiffre_affaires?: number;
  date_creation?: string;
  representants?: { nom_complet?: string }[];
}

function toRecord(raw: RawCompany): CompanyRecord {
  return {
    siren: raw.siren,
    name: raw.nom_entreprise ?? "",
    naf: raw.code_naf,
    headcount: raw.effectif_min,
    revenue: raw.chiffre_affaires,
    incorporatedAt: raw.date_creation ? new Date(raw.date_creation) : undefined,
    directorName: raw.representants?.[0]?.nom_complet,
  };
}
