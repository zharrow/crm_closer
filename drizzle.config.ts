import type { Config } from "drizzle-kit";

/**
 * `.env.local` est une convention Next.js : drizzle-kit tourne hors de
 * Next et ne la connaît pas. Sans ce chargement explicite, `db:migrate`
 * échoue sur « url: undefined » alors que le fichier est bien là.
 *
 * `loadEnvFile` est natif depuis Node 22. En CI ou sur Vercel le fichier
 * n'existe pas et les variables viennent de la plateforme : on ignore
 * l'absence plutôt que de faire échouer la commande.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // pas de .env.local : les variables viennent de l'environnement
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Le pooler Supabase (6543) ne sait pas exécuter du DDL : les
    // migrations passent par la connexion directe (5432).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  strict: true,
} satisfies Config;
