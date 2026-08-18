import { db, sequences, sequenceSteps, settings } from "./client";
import { SEQUENCE_BLUEPRINTS, type SequenceKey } from "../lib/default-sequence";

/**
 * Optionnel : l'app crée ses séquences d'elle-même au premier accès. Ce
 * script sert à préparer une base à l'avance, ou à repartir de séquences
 * propres après les avoir modifiées.
 */
async function seed() {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();

  for (const key of Object.keys(SEQUENCE_BLUEPRINTS) as SequenceKey[]) {
    const blueprint = SEQUENCE_BLUEPRINTS[key];

    const [sequence] = await db
      .insert(sequences)
      .values(blueprint.sequence)
      .onConflictDoNothing()
      .returning({ id: sequences.id });

    if (!sequence) {
      console.log(`Séquence « ${key} » déjà présente, rien à faire.`);
      continue;
    }

    await db
      .insert(sequenceSteps)
      .values(blueprint.steps.map((step) => ({ ...step, sequenceId: sequence.id })));

    console.log(`Séquence « ${key} » créée : ${blueprint.steps.length} étapes.`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
