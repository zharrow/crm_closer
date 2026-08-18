import { runDailyCycle, type CycleEvent } from "@/lib/daily-cycle";
import { currentUser, isAllowedEmail } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Le cycle quotidien, en flux.
 *
 * Une action serveur ne peut rien dire avant d'avoir fini : elle rend une
 * valeur, une fois. Or le cycle dure des minutes et l'attente n'a de sens
 * que si on sait ce qui se passe. D'où une route qui pousse une ligne de
 * JSON par événement, lue au fil de l'eau par l'IHM.
 *
 * L'authentification est celle de la session, comme pour le reste de
 * l'app — c'est le proxy qui la garantit, revérifiée ici parce qu'une
 * route qui déclenche des dépenses d'API ne se repose pas sur une seule
 * barrière.
 */
export async function POST() {
  const user = await currentUser();
  if (!user || !isAllowedEmail(user.email)) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CycleEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await runDailyCycle(send);
      } catch (error) {
        // Panne hors étape (réglages illisibles, base injoignable) :
        // le client attend toujours un `done`, sinon il tourne dans le vide.
        send({
          type: "done",
          report: {
            sourced: 0,
            enrolled: 0,
            errors: [error instanceof Error ? error.message : String(error)],
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      // `no-transform` : sans ça un intermédiaire peut tamponner la
      // réponse et la livrer d'un bloc à la fin, ce qui annule le flux.
      "cache-control": "no-store, no-transform",
    },
  });
}
