import { and, count, lte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, tasks } from "@/db/client";
import { currentUser, isAllowedEmail } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  // Deuxième barrière après le middleware : une session valide ne suffit
  // pas, il faut aussi être sur la liste des comptes autorisés.
  if (!isAllowedEmail(user.email)) redirect("/login?erreur=non-autorise");

  // Le compteur de la pastille doit compter *ce que la page montre*.
  // Il ne retenait que les tâches déjà rédigées : une action due mais pas
  // encore écrite — le cas le plus courant, puisque la rédaction se
  // déclenche à la main — n'y figurait pas. La barre annonçait 3 là où la
  // file en contenait 7, et un nombre qui ment cesse d'être regardé.
  // Même filtre que `loadDueTasks()` dans `page.tsx`.
  const [pending] = await db
    .select({ n: count() })
    .from(tasks)
    .where(
      and(
        lte(tasks.dueAt, new Date()),
        sql`${tasks.status} in ('pending', 'drafted', 'failed')`,
      ),
    );

  return (
    <>
      {/* Cinq éléments focusables séparent le haut de page du contenu.
          Le lien reste invisible jusqu'à ce qu'on l'atteigne au clavier. */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <Nav pendingCount={pending?.n ?? 0} />
      <main id="contenu" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </>
  );
}
