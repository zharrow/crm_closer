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

/** L'utilisateur courant, ou null. Vérifié côté serveur Supabase. */
export async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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
