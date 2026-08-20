import { Skeleton, SkeletonScreen } from "@/components/skeleton";

/**
 * Le squelette a la forme de la grille, pas une pile de trois boîtes.
 *
 * Il annonçait trois cartes pleine largeur là où la page en rend une grande
 * et deux petites : au remplacement, tout se réorganisait sous l'œil. Un
 * squelette qui promet autre chose que ce qui arrive fait exactement le
 * saut qu'il est censé éviter.
 */
function Panel({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={`rounded-panel bg-card p-6 shadow-raised dark:border ${className ?? ""}`}>
      <Skeleton className="h-6 w-40" />
      <div className="mt-6 flex flex-col gap-5">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <SkeletonScreen label="Chargement des réglages">
      {/* Mêmes seuils que la page : un squelette qui se réorganise à une
          autre largeur qu'elle fait sauter l'écran au remplacement. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div>
          <Skeleton className="h-11 w-56" />
          <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <div>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="mt-1.5 h-3 w-32" />
          </div>
        </div>
      </div>

      <div className="@container grid gap-5 @min-[680px]:grid-cols-12">
        <Panel className="@min-[680px]:col-span-7" lines={3} />
        <Panel className="@min-[680px]:col-span-5" lines={3} />
        <Panel className="@min-[680px]:col-span-12" lines={1} />
      </div>
    </SkeletonScreen>
  );
}
