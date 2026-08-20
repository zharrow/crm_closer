import { Skeleton, SkeletonScreen } from "@/components/skeleton";

export default function TodayLoading() {
  return (
    <SkeletonScreen label="Chargement de la file du jour">
      {/* Titre à gauche, bandeau de chiffres à droite — la composition de
          la vraie page. Un squelette qui annonce autre chose que ce qui
          arrive fait sauter l'écran au remplacement, ce qui est exactement
          ce qu'il est censé éviter. La barre de titre fait 45 px de haut
          comme le titre lui-même, pas 32. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <Skeleton className="h-11 w-80 max-w-full" />
          <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <div>
                <Skeleton className="h-7 w-14" />
                <Skeleton className="mt-1.5 h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Une carte ouverte, puis des lignes repliées : c'est la forme de la
          file, et le squelette n'a aucune raison d'en promettre une autre. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="rounded-panel bg-card p-6 shadow-raised dark:border">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-5 w-10" />
          </div>
          <Skeleton className="mt-3 h-3 w-72 max-w-full" />
          <Skeleton className="mt-5 h-9 w-full" />
          <Skeleton className="mt-3 h-40 w-full" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-panel bg-card px-5 py-4 shadow-raised dark:border">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-9" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
