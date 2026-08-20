import { Skeleton, SkeletonScreen } from "@/components/skeleton";

export default function ProspectsLoading() {
  return (
    <SkeletonScreen label="Chargement des prospects">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-11 w-56" />
          <Skeleton className="mt-3 h-5 w-28" />
        </div>
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-10 w-full rounded-xl sm:max-w-xs sm:flex-1" />
        <div className="flex flex-wrap gap-1.5">
          {["w-14", "w-20", "w-24", "w-28", "w-16", "w-14", "w-20", "w-16"].map((w, i) => (
            <Skeleton key={i} className={`h-8 rounded-full ${w}`} />
          ))}
        </div>
      </div>

      {/* Le tableau garde sa hauteur de ligne : au remplacement, rien ne
          saute et l'œil reste sur la ligne qu'il visait. */}
      <div className="overflow-hidden rounded-panel bg-card shadow-raised dark:border">
        <div className="border-b bg-muted px-4 py-3">
          <Skeleton className="h-3 w-24" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <div className="flex-1">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="mt-1.5 h-3 w-32" />
            </div>
            <Skeleton className="hidden h-4 w-20 sm:block" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-9" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
