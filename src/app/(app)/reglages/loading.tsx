import { Skeleton, SkeletonScreen } from "@/components/skeleton";

export default function SettingsLoading() {
  return (
    <SkeletonScreen label="Chargement des réglages">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>

      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-6 shadow-sm">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-4 w-40" />
          <Skeleton className="mt-2 h-20 w-full" />
        </div>
      ))}
    </SkeletonScreen>
  );
}
