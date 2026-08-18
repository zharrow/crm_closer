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
 */
const client = postgres(connectionString, {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
export * from "./schema";
