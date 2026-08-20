import { and, lte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, leads, tasks } from "@/db/client";
import { currentUser, isAllowedEmail } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

export const dynamic = "force-dynamic";

/**
 * Les deux compteurs du rail, en une seule requête.
 *
 * Ils portent sur deux tables différentes, donc pas de `count(*) filter`
 * possible comme dans `page.tsx` — mais deux sous-requêtes scalaires dans
 * un même `select` tiennent en un aller-retour et une seule connexion. Ce
 * n'est pas de la coquetterie : `src/db/client.ts` fixe le pool à 8 et
 * documente que la page la plus chargée en occupe déjà cinq à la fois. Le
 * rail a gagné un compteur, il n'a pas à coûter une connexion de plus.
 *
 * Le compteur de « À faire » doit compter *ce que la page montre* : même
 * filtre que `loadDueTasks()` dans `page.tsx`. Il ne retenait autrefois que
 * les tâches déjà rédigées — une action due mais pas encore écrite, le cas
 * le plus courant puisque la rédaction se déclenche à la main, n'y figurait
 * pas. La barre annonçait 3 là où la file en contenait 7, et un nombre qui
 * ment cesse d'être regardé.
 *
 * L'échéance est comparée à une date envoyée depuis Node, et non au `now()`
 * de Postgres : c'est la même valeur que celle qu'emploie la page, et deux
 * horloges pour une même frontière finiraient par ne pas dire la même chose.
 *
 * Elle passe par `lte()` et non par un `${new Date()}` posé à la main dans
 * le gabarit. Un gabarit `sql` ne connaît pas la colonne visée, donc pas son
 * type : postgres.js recevait un `Date` sans indication et refusait de le
 * sérialiser (« must be of type string or Buffer, received Date »). Écrire
 * la comparaison avec l'opérateur typé redonne à drizzle le contexte de
 * `tasks.dueAt`, et c'est au passage exactement la même expression que
 * `loadDueTasks()` — les deux compteurs ne peuvent plus diverger.
 */
async function loadNavCounts() {
  const rows = await db.execute<{ pending: number; leads: number }>(sql`
    select
      (select count(*)::int
         from ${tasks}
        where ${and(
          lte(tasks.dueAt, new Date()),
          sql`${tasks.status} in ('pending', 'drafted', 'failed')`,
        )}) as pending,
      (select count(*)::int from ${leads}) as leads
  `);

  const row = rows[0];
  return { pending: row?.pending ?? 0, leads: row?.leads ?? 0 };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  // Deuxième barrière après le middleware : une session valide ne suffit
  // pas, il faut aussi être sur la liste des comptes autorisés.
  if (!isAllowedEmail(user.email)) redirect("/login?erreur=non-autorise");

  const counts = await loadNavCounts();

  return (
    <>
      {/* Cinq éléments focusables séparent le haut de page du contenu.
          Le lien reste invisible jusqu'à ce qu'on l'atteigne au clavier. */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-5 focus:z-50 focus:rounded-full focus:bg-cobalt focus:px-4 focus:py-2 focus:text-dense focus:font-medium focus:text-on-cobalt focus:shadow-tone"
      >
        Aller au contenu
      </a>
      {/* Le rail et le contenu sont côte à côte à partir de `lg` ; en
          dessous, `Nav` rend une capsule horizontale et ce conteneur ne fait
          plus rien. La largeur du rail est portée par `Nav` lui-même —
          c'est lui qui sait s'il s'affiche.

          Le rail flotte à trois unités du bord : le contenu ne colle donc
          pas contre lui, il respire du même écart de l'autre côté. */}
      <div className="lg:flex lg:items-start">
        <Nav pendingCount={counts.pending} leadCount={counts.leads} />
        <main
          id="contenu"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:pl-4"
        >
          {children}
        </main>
      </div>
    </>
  );
}
