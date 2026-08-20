import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL manquant. Copie la chaîne « Transaction pooler » (port 6543) depuis Supabase → Connect.",
  );
}

/**
 * Une chaîne restée à sa valeur d'exemple passe le test « non vide » mais
 * échoue à la première requête, avec une erreur SQL brute qui ne dit rien
 * de la cause. On la rattrape ici, là où on peut encore nommer le
 * problème.
 */
const PLACEHOLDERS = ["xxxx", "MOTDEPASSE", "[YOUR-PASSWORD]", "YOUR-PASSWORD"];
const placeholder = PLACEHOLDERS.find((token) => connectionString.includes(token));

if (placeholder) {
  throw new Error(
    `DATABASE_URL contient encore « ${placeholder} » : c'est la valeur d'exemple, ` +
      "pas ta vraie chaîne de connexion. Récupère-la dans Supabase → Connect → " +
      "Transaction pooler (port 6543), et remplace [YOUR-PASSWORD] par le mot de " +
      "passe de la base.",
  );
}

/**
 * Supabase en mode transaction (pooler, port 6543) : pgbouncer ne sait pas
 * gérer les prepared statements, d'où `prepare: false`.
 *
 * `max` ne peut PAS descendre à 1. Une page rend souvent plusieurs
 * requêtes en parallèle (`Promise.all`), et postgres.js les empile alors
 * sur la même connexion. Au-delà de trois requêtes distinctes empilées,
 * le pooler transactionnel de Supabase cesse de répondre : la requête
 * reste en vol jusqu'à ce que `statement_timeout` (2 min) l'annule, et
 * l'app renvoie « canceling statement due to statement timeout ».
 * Mesuré : 3 requêtes concurrentes passent, 4 bloquent. Avec un pool,
 * chaque requête part sur sa propre connexion et le problème disparaît.
 *
 * `max: 8` et non 5 : la page la plus chargée en lance désormais cinq à la
 * fois (le compteur de la barre, plus les quatre de la fiche prospect, qui
 * partaient auparavant en trois vagues successives). À cinq exactement, la
 * moindre requête supplémentaire se remet à attendre son tour — la marge
 * est là pour ça, et une connexion de plus n'est ouverte que si elle sert.
 *
 * `idle_timeout: 60` et non 20 : ouvrir une connexion coûte ~280 ms, la
 * requête elle-même ~35 ms. À vingt secondes, une pause dans la navigation
 * suffisait à tout refermer, et la page suivante repayait l'établissement
 * du lien — huit fois le prix de ce qu'elle venait chercher.
 */
const client = postgres(connectionString, {
  prepare: false,
  max: 8,
  idle_timeout: 60,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
export * from "./schema";
