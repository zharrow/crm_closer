import { Skeleton, SkeletonScreen } from "@/components/skeleton";

export default function LeadLoading() {
  return (
    <SkeletonScreen label="Chargement de la fiche prospect">
      <div>
        <Skeleton className="h-4 w-24" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <div className="rounded-panel bg-card p-6 shadow-raised dark:border">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-4 h-24 w-full" />
          </div>
          <div className="rounded-panel bg-card p-6 shadow-raised dark:border">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-4 h-32 w-full" />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="rounded-panel bg-card p-6 shadow-raised dark:border">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-4 h-28 w-full" />
          </div>
          <div className="rounded-panel bg-card p-6 shadow-raised dark:border">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-4 h-24 w-full" />
          </div>
        </div>
      </div>
    </SkeletonScreen>
  );
}
