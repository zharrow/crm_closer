"use client";

import { useEffect } from "react";
import { ActionButton } from "@/components/action-button";

/**
 * Le diagnostic doit lire toute la chaîne, pas le premier maillon.
 *
 * drizzle enveloppe l'erreur de Postgres : `error.message` vaut
 * « Failed query: select … » et la vraie cause — « canceling statement due
 * to statement timeout » — est rangée dans `error.cause`. En ne regardant
 * que `message`, aucune branche ne pouvait matcher : on tombait sur le cas
 * par défaut, et la page affichait la requête SQL en entier. C'est
 * exactement ce que DESIGN.md interdit, et ça a tenu parce que le test
 * portait sur la mauvaise propriété.
 *
 * `cause` ne franchit pas toujours la frontière serveur → client : Next ne
 * sérialise pas toute la chaîne. On la lit quand elle est là, et la
 * détection de forme ci-dessous prend le relais quand elle ne l'est pas.
 */
function fullText(error: unknown, depth = 0): string {
  if (depth > 4 || !error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    return `${error.message} ${fullText(error.cause, depth + 1)}`;
  }
  return "";
}

/**
 * Les pannes qui arrivent ici sont presque toujours des problèmes de
 * configuration, pas des bugs : base injoignable, migrations pas encore
 * appliquées, clé absente. On nomme la cause probable et l'action à
 * faire, plutôt que d'afficher une requête SQL brute.
 *
 * L'ordre des branches est significatif : de la cause la plus précise à la
 * plus générale. Une branche large placée trop haut vole les cas d'une
 * branche fine placée plus bas, et le diagnostic devient faux sans jamais
 * devenir absent — le pire des deux mondes.
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

  /* Doit passer avant « base injoignable » : le mot « timeout » est présent
     dans les deux, et un statement timeout n'a rien à voir avec un projet
     en pause — la base répond très bien, c'est la requête qui est restée en
     vol. Diagnostiquer l'un pour l'autre envoie chercher au mauvais
     endroit, ce qui coûte plus cher que pas de diagnostic du tout. */
  if (/canceling statement|statement timeout/i.test(message)) {
    return {
      title: "La requête est restée en vol",
      hint: "La base a annulé la requête au bout de deux minutes. Elle n'est pas lente — le pooler transactionnel de Supabase se coince quand trop de requêtes s'empilent sur une même connexion (voir le commentaire de src/db/client.ts). Recharge : la requête suivante repart sur une connexion neuve. Si ça se répète, c'est le pool qu'il faut regarder, pas la requête.",
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

  /* Le filet de sécurité : `Failed query:` est la signature de drizzle, et
     elle veut toujours dire « l'appel à la base a échoué ». Même privé de
     `cause`, on sait donc nommer la famille du problème — et surtout, on
     cesse d'afficher deux cents caractères de SQL comme s'ils étaient le
     message destiné à la personne qui lit. */
  if (/^Failed query:/i.test(message)) {
    return {
      title: "La base n'a pas répondu",
      hint: "La requête a bien été envoyée mais n'a pas abouti. Les deux causes habituelles : le projet Supabase est en pause (les projets gratuits s'endorment), ou le pooler s'est coincé. Recharge d'abord ; le détail de la requête est plus bas.",
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

  const { title, hint, command } = diagnose(fullText(error));

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 py-12">
      <div>
        <h1 className="display text-headline">{title}</h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">{hint}</p>
      </div>

      {command && (
        <pre className="overflow-x-auto rounded-2xl bg-muted p-4 text-dense">
          <code>{command}</code>
        </pre>
      )}

      <details className="rounded-2xl bg-muted p-4">
        <summary className="cursor-pointer text-dense font-medium">
          Détail technique
        </summary>
        {/* La chaîne complète, et non le seul `message` : quand la vraie
            cause est dans `cause`, c'est elle qu'on vient chercher ici. */}
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-meta leading-relaxed text-muted-foreground">
          {fullText(error).trim()}
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
