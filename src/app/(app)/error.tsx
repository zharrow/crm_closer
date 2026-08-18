"use client";

import { useEffect } from "react";
import { ActionButton } from "@/components/action-button";

/**
 * Les pannes qui arrivent ici sont presque toujours des problèmes de
 * configuration, pas des bugs : base injoignable, migrations pas encore
 * appliquées, clé absente. On nomme la cause probable et l'action à
 * faire, plutôt que d'afficher une requête SQL brute.
 */
function diagnose(message: string): { title: string; hint: string; command?: string } {
  if (/DATABASE_URL/i.test(message)) {
    return {
      title: "La base de données n'est pas configurée",
      hint: "DATABASE_URL est absent ou contient encore la valeur d'exemple. Récupère la chaîne « Transaction pooler » (port 6543) dans Supabase → Connect, puis relance le serveur.",
    };
  }

  if (/relation .* does not exist|does not exist/i.test(message)) {
    return {
      title: "Les tables n'existent pas encore",
      hint: "La connexion fonctionne, mais le schéma n'a jamais été appliqué.",
      command: "pnpm db:migrate && pnpm db:seed",
    };
  }

  if (/password authentication failed|SASL|authentication/i.test(message)) {
    return {
      title: "Mot de passe de la base refusé",
      hint: "La chaîne de connexion est bien formée mais le mot de passe est faux. Attention : c'est le mot de passe de la base, pas celui de ton compte. Tu peux le réinitialiser dans Supabase → Settings → Database.",
    };
  }

  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|timeout/i.test(message)) {
    return {
      title: "Base injoignable",
      hint: "L'hôte de la chaîne de connexion ne répond pas. Vérifie que le projet Supabase n'est pas en pause (les projets gratuits s'endorment après une semaine d'inactivité).",
    };
  }

  if (/ANTHROPIC_API_KEY/i.test(message)) {
    return {
      title: "Clé Anthropic absente",
      hint: "Ajoute ANTHROPIC_API_KEY dans .env.local, puis relance le serveur. Sans elle, aucune rédaction n'est possible.",
    };
  }

  return {
    title: "Quelque chose a cassé",
    hint: "Le détail technique est ci-dessous.",
  };
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const { title, hint, command } = diagnose(error.message);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 py-12">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">{hint}</p>
      </div>

      {command && (
        <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4 text-sm">
          <code>{command}</code>
        </pre>
      )}

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Détail technique
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-relaxed text-muted-foreground">
          {error.message}
        </pre>
      </details>

      <div>
        <ActionButton
          onClick={reset}
          variant="outline"
          size="sm"
          tooltip="Retente le rendu de la page. Utile si la panne était passagère."
        >
          Réessayer
        </ActionButton>
      </div>
    </div>
  );
}
