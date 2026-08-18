import { Skeleton, SkeletonScreen } from "@/components/skeleton";

export default function TodayLoading() {
  return (
    <SkeletonScreen label="Chargement de la file du jour">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        {/* La ligne de compteurs, aux mêmes dimensions : un squelette qui
            annonce autre chose que ce qui arrive fait sauter la page. */}
        <div className="flex flex-wrap items-center gap-5 border-t pt-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* Une carte ouverte, puis des lignes repliées : c'est la forme de la
          file, et le squelette n'a aucune raison d'en promettre une autre. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="rounded-xl border bg-card p-6 shadow-sm">
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
          <div key={i} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
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
