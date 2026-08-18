import { cn } from "@/lib/utils";

/**
 * Une forme grise à la place de ce qui n'est pas encore arrivé.
 *
 * Les pages sont en `force-dynamic` : chaque navigation attend Postgres.
 * Sans `loading.tsx`, l'écran restait figé sur la page précédente pendant
 * tout l'aller-retour — on ne savait pas si le clic avait pris. Le squelette
 * répond à la seule question posée pendant l'attente : « est-ce que ça
 * charge, et qu'est-ce qui va arriver ? ». Il reprend donc les dimensions du
 * vrai contenu, sinon la page saute au moment du remplacement.
 *
 * L'animation est neutralisée par la règle `prefers-reduced-motion` de
 * `globals.css`, qui ramène toutes les durées à 0,01 ms.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

/**
 * L'enveloppe d'un écran en chargement.
 *
 * `aria-busy` et le texte caché disent au lecteur d'écran ce que la teinte
 * grise dit à l'œil : un squelette muet n'annonce rien du tout.
 */
export function SkeletonScreen({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
