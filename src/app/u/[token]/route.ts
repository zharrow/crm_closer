import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { suppressLead } from "@/lib/suppressions";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ token: string }>;
}

/**
 * Page de désinscription, publique par nature : c'est le destinataire
 * d'un email qui l'ouvre, il n'a évidemment pas de session.
 *
 * Le POST couvre le clic natif de Gmail et Outlook, le GET le clic
 * manuel depuis le pied de page.
 */
export async function POST(_request: Request, context: Context) {
  return unsubscribe(context, "Désinscription enregistrée.");
}

export async function GET(_request: Request, context: Context) {
  return unsubscribe(context, "Vous ne recevrez plus de messages de notre part.");
}

async function unsubscribe(context: Context, confirmation: string) {
  const { token } = await context.params;
  const leadId = verifyUnsubscribeToken(token);

  // Jeton invalide : on renvoie la même page qu'un succès. Distinguer les
  // deux permettrait de tester l'existence d'un lead par énumération.
  if (leadId) {
    try {
      await suppressLead(leadId, "unsubscribe");
    } catch (error) {
      console.error("[unsubscribe]", error);
    }
  }

  return new NextResponse(page(confirmation), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function page(message: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Désinscription</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:32rem;margin:6rem auto;padding:0 1.5rem;color:#18181b;line-height:1.6">
<p style="font-size:1.125rem">${message}</p>
<p style="color:#71717a;font-size:0.9rem">Votre adresse a été ajoutée à notre liste d'exclusion permanente.</p>
</body>
</html>`;
}
