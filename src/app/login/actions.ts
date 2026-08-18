"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, isAllowedEmail } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
}

/**
 * Connexion par mot de passe.
 *
 * Il n'y a volontairement aucune route d'inscription : le compte est créé
 * une fois depuis le tableau de bord Supabase. Pas de formulaire public,
 * donc aucune surface d'inscription à défendre.
 */
export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Renseigne ton adresse et ton mot de passe." };
  }

  // Liste blanche vide = problème de configuration, pas de tentative
  // d'intrusion : on le dit clairement plutôt que de laisser chercher.
  if (!process.env.ALLOWED_EMAILS?.trim()) {
    return {
      error: "ALLOWED_EMAILS n'est pas configuré. Personne ne peut se connecter.",
    };
  }

  // Adresse hors liste : même message qu'un mot de passe faux. Distinguer
  // les deux révélerait qui a le droit d'entrer.
  if (!isAllowedEmail(email)) {
    return { error: "Adresse ou mot de passe incorrect." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Adresse ou mot de passe incorrect." };
  }

  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/");
}
