import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Ex-`middleware.ts` : depuis Next 16 la convention s'appelle `proxy`,
 * et elle tourne forcément sur le runtime Node (l'edge n'y est pas
 * supporté, et `export const runtime` y est interdit). Rien d'autre ne
 * change — même signature, même objet `config`.
 *
 * Tout est privé sauf ce qui est listé ici.
 *
 * - `/u/...` : lien de désinscription, forcément public — c'est le
 *   destinataire d'un email qui l'ouvre, il n'a pas de session.
 * - `/api/jobs/...` : authentifié par la signature QStash, pas par un
 *   cookie ; la vérification se fait dans la route elle-même.
 * - `/api/cron/...` : authentifié par l'en-tête d'autorisation Vercel.
 *
 * Il n'y a pas de route d'inscription : le compte est créé une seule
 * fois depuis le tableau de bord Supabase.
 */
const PUBLIC_PREFIXES = ["/login", "/u/", "/api/jobs", "/api/cron"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Ne pas insérer de logique entre createServerClient et la vérification :
  // le rafraîchissement du jeton se joue ici, et une session non
  // rafraîchie déconnecte l'utilisateur de façon aléatoire.
  //
  // `getClaims()` et non `getUser()` : le proxy tourne sur *chaque*
  // requête, y compris chaque navigation client et chaque préchargement.
  // `getUser()` y ajoutait un aller-retour vers le serveur d'auth
  // Supabase — 90 à 250 ms mesurés — avant que le rendu ne commence.
  // Les jetons du projet étant signés en ES256, la signature se vérifie
  // en local contre un JWKS mis en cache pour tout le processus. Voir
  // `lib/supabase/server.ts` pour le détail.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
