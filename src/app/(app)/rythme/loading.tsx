import { Skeleton, SkeletonScreen } from "@/components/skeleton";

/**
 * Les colonnes du squelette ont des hauteurs *différentes*.
 *
 * Vingt-neuf barres identiques annonceraient une donnée plate, et le
 * remplacement ferait sauter tout le graphique d'un coup. Des hauteurs
 * variées ne prétendent à aucune valeur : elles disent seulement « il y aura
 * un relief ici », ce qui est exactement ce qu'un squelette doit promettre.
 */
const HEIGHTS = [
  40, 68, 24, 12, 56, 80, 32, 12, 48, 64, 28, 44, 72, 36, 12, 52, 60, 24, 40,
  76, 32, 12, 44, 56, 20, 36, 48, 28, 12,
];

export default function RhythmLoading() {
  return (
    <SkeletonScreen label="Chargement du rythme">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div>
          <Skeleton className="h-11 w-48" />
          <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <div>
                <Skeleton className="h-7 w-12" />
                <Skeleton className="mt-1.5 h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-panel bg-card p-6 shadow-raised dark:border">
        <Skeleton className="h-4 w-48" />
        <div className="mt-6 flex items-end gap-1">
          {HEIGHTS.map((height, i) => (
            /* La hauteur passe par l'enveloppe : `Skeleton` ne prend qu'une
               `className`, et fabriquer vingt-neuf classes arbitraires pour
               vingt-neuf hauteurs coûterait plus cher que ce `div`. */
            <div key={i} className="flex-1" style={{ height }}>
              <Skeleton className="h-full w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-3 h-3 w-full" />
      </div>
    </SkeletonScreen>
  );
}
