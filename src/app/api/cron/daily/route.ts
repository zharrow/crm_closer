import { NextResponse, type NextRequest } from "next/server";
import { runDailyCycle } from "@/lib/daily-cycle";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Une seule exécution par jour — c'est ce que permet le plan Vercel Hobby.
 *
 * La route ne fait qu'authentifier puis déléguer : l'enchaînement lui-même
 * vit dans `lib/daily-cycle`, partagé avec le bouton « Lancer un cycle »
 * des réglages, pour que les deux chemins ne puissent pas diverger.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  const report = await runDailyCycle();
  console.log("[cron]", report);
  return NextResponse.json(report);
}

/**
 * Vercel signe ses appels de cron avec `CRON_SECRET`. En son absence on
 * refuse tout : mieux vaut un cron qui ne tourne pas qu'une route qui
 * déclenche des dépenses d'API pour qui la découvre.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
