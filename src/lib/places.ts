const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/**
 * Le masque de champs détermine le palier de facturation de l'API Places.
 * Chaque champ ajouté peut faire basculer la requête dans une tranche
 * supérieure — ne l'élargis pas sans avoir vérifié la grille tarifaire en
 * vigueur dans la console Google Cloud.
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.userRatingCount",
  "nextPageToken",
].join(",");

export interface PlaceResult {
  id: string;
  name: string;
  address?: string;
  website?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  reviewCount?: number;
}

interface SearchOptions {
  query: string;
  /** 3 pages maximum côté Google, soit 60 résultats. */
  maxPages?: number;
}

export async function searchPlaces({
  query,
  maxPages = 2,
}: SearchOptions): Promise<PlaceResult[]> {
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const body = await requestPage(query, pageToken);
    results.push(...(body.places ?? []).map(toResult));

    pageToken = body.nextPageToken;
    if (!pageToken) break;

    // Google refuse le pageToken pendant quelques instants après émission.
    await sleep(2000);
  }

  return results;
}

/* ------------------------------------------------------------------ */

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
}

interface RawResponse {
  places?: RawPlace[];
  nextPageToken?: string;
}

async function requestPage(query: string, pageToken?: string): Promise<RawResponse> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY manquant");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "fr",
      regionCode: "FR",
      pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Places ${response.status} : ${await response.text()}`);
  }

  return (await response.json()) as RawResponse;
}

function toResult(place: RawPlace): PlaceResult {
  return {
    id: place.id,
    name: place.displayName?.text ?? "Sans nom",
    address: place.formattedAddress,
    website: place.websiteUri,
    phone: place.nationalPhoneNumber,
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    reviewCount: place.userRatingCount,
  };
}

/** Extrait le code postal d'une adresse française formatée. */
export function postalCodeFrom(address: string | undefined): string | null {
  const match = address?.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

export function cityFrom(address: string | undefined): string | null {
  const match = address?.match(/\b\d{5}\s+([^,]+)/);
  return match ? match[1].trim() : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
