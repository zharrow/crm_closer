ALTER TABLE "leads" ADD COLUMN "review_count" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "need_score" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "value_score" integer;--> statement-breakpoint
-- Les leads déjà scorés l'ont été sur l'ancien modèle, entièrement fait
-- de signaux de besoin. On reporte donc leur score tel quel côté besoin,
-- valeur à zéro : sans ça la fiche afficherait « besoin — » sur des
-- prospects parfaitement scorés, et le prochain enrichissement corrigera.
UPDATE "leads" SET "need_score" = "score", "value_score" = 0 WHERE "score" IS NOT NULL;
