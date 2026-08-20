"use client";

import { useActionState } from "react";
import { ActionButton } from "@/components/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Adresse email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="username"
          placeholder="toi@exemple.fr"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-2xl bg-tint-clay p-4 text-dense text-foreground"
        >
          {state.error}
        </p>
      )}

      <ActionButton
        type="submit"
        disabled={pending}
        tooltip="Envoie tes identifiants à Supabase pour ouvrir une session."
      >
        {pending ? "Connexion…" : "Se connecter"}
      </ActionButton>
    </form>
  );
}
