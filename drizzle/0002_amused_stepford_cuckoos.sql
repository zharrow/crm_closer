CREATE TYPE "public"."suggestion_status" AS ENUM('proposed', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TABLE "query_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"rationale" text,
	"status" "suggestion_status" DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "source_query" text;--> statement-breakpoint
CREATE UNIQUE INDEX "query_suggestions_query_key" ON "query_suggestions" USING btree (lower("query"));--> statement-breakpoint
CREATE INDEX "query_suggestions_status_idx" ON "query_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_source_query_idx" ON "leads" USING btree ("source_query");--> statement-breakpoint
-- Même verrouillage que la migration 0001 : toute table du schéma
-- `public` est exposée par PostgREST avec la clé anonyme. RLS sans
-- policy referme cette porte. L'app n'est pas concernée, elle passe par
-- Drizzle sur la connexion Postgres directe.
ALTER TABLE "query_suggestions" ENABLE ROW LEVEL SECURITY;
