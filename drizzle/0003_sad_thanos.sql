ALTER TABLE "sequences" ADD COLUMN "key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "sequences_key_key" ON "sequences" USING btree ("key");--> statement-breakpoint
-- La séquence déjà en base est celle par email : on lui pose sa clé, sinon
-- le routage par canal ne la reconnaîtrait pas et en créerait une seconde
-- en doublon, avec les inscriptions existantes rattachées à l'ancienne.
UPDATE "sequences" SET "key" = 'email'
WHERE "key" IS NULL
  AND "id" = (SELECT "id" FROM "sequences" ORDER BY "created_at" ASC LIMIT 1);
