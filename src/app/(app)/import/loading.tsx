import { Skeleton, SkeletonScreen } from "@/components/skeleton";

/**
 * L'import n'interroge pas la base : la page est du texte et un formulaire.
 * Elle attendait quand même, faute d'écran d'attente à elle — c'est celui
 * de la file du jour qui s'affichait, avec ses cartes d'actions, avant de
 * laisser place à tout autre chose. Un squelette qui annonce la mauvaise
 * page est pire qu'un écran figé : il promet.
 */
export default function ImportLoading() {
  return (
    <SkeletonScreen label="Chargement de l'import CSV">
      <div>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>

      {/* La carte des colonnes reconnues : un titre, une phrase, deux
          colonnes de huit lignes. */}
      <div className="rounded-panel bg-card p-6 shadow-raised dark:border">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-4 w-full max-w-lg" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {["w-52", "w-48", "w-40", "w-44", "w-36", "w-32", "w-44", "w-24"].map((w, i) => (
            <Skeleton key={i} className={`h-4 ${w}`} />
          ))}
        </div>
        <Skeleton className="mt-5 h-4 w-full max-w-md" />
      </div>

      {/* La zone de dépôt, à la hauteur qu'elle occupe une fois là. */}
      <div className="rounded-panel border-2 border-dashed bg-card py-12">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
