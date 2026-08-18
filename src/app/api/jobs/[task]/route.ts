import { NextResponse, type NextRequest } from "next/server";
import { isJobName, runJob } from "@/jobs";
import { verifyQstashSignature } from "@/lib/queue";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Point d'entrée des jobs différés.
 *
 * Cette route est publique — c'est la signature QStash qui authentifie,
 * pas la session. Sans clés de signature configurées, `verifyQstashSignature`
 * renvoie false et tout est refusé : un endpoint de job non signé serait
 * un endpoint ouvert sur la base.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ task: string }> },
) {
  const { task } = await context.params;
  const body = await request.text();

  const valid = await verifyQstashSignature(
    request.headers.get("upstash-signature"),
    body,
  );

  if (!valid) {
    return NextResponse.json({ error: "signature invalide" }, { status: 401 });
  }

  if (!isJobName(task)) {
    return NextResponse.json({ error: `job inconnu : ${task}` }, { status: 404 });
  }

  try {
    await runJob(task, JSON.parse(body || "{}"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`[job:${task}]`, error);
    // 500 pour que QStash réessaie selon sa politique de retry.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "échec" },
      { status: 500 },
    );
  }
}
