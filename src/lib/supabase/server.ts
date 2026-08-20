import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé depuis un Server Component : le rafraîchissement de
            // session est déjà fait par le middleware, on peut ignorer.
          }
        },
      },
    },
  );
}

/**
 * L'utilisateur courant, ou null. Vérifié cryptographiquement.
 *
 * `getUser()` interrogeait le serveur d'auth Supabase à chaque appel :
 * 90 à 250 ms mesurés, payés sur chaque rendu de page et chaque action.
 * Or ce projet signe ses jetons en ES256 — une clé asymétrique, dont la
 * partie publique est servie sur `/.well-known/jwks.json`. `getClaims()`
 * récupère ce jeu de clés une fois, le garde en mémoire pour tout le
 * processus, et vérifie ensuite la signature en local via WebCrypto.
 *
 * La garantie est la même : une signature ES256 ne se falsifie pas sans
 * la clé privée, qui ne quitte jamais Supabase. Ce qui disparaît est
 * l'aller-retour réseau, pas le contrôle.
 *
 * Le rafraîchissement du jeton reste assuré — `getClaims()` renouvelle la
 * session quand l'expiration approche, avant de vérifier.
 */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return { id: data.claims.sub, email: data.claims.email ?? null };
}

/**
 * Un seul compte a le droit d'entrer. Supabase autorise l'inscription
 * libre par défaut : sans cette liste, quiconque connaît l'URL peut se
 * créer un accès à ton pipeline commercial.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return false;
  return Boolean(email && allowed.includes(email.toLowerCase()));
}
