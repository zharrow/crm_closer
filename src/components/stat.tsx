import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Un chiffre qu'on lit avant le reste : une pastille, un nombre, un mot.
 *
 * Le dispositif est né sur la file du jour puis a été repris sur les
 * réglages et sur le rythme. Il vit ici pour que les trois écrans qui
 * l'emploient n'en aient pas trois variantes — c'est la même faute que les
 * cartes de groupement avant `SectionHeading`.
 *
 * **La pastille n'est pas une décoration** : c'est ce qui rend plusieurs
 * compteurs distinguables *avant* la lecture. Elle prend un ton plein quand
 * le chiffre est un acquis, une pastille pâle sinon — si tous portaient un
 * ton plein, plus rien ne les départagerait.
 *
 * **Le nombre est en caractère d'affichage et en chiffres tabulaires.** Il
 * grandit d'un cran chaque jour, et une colonne qui se décale à chaque
 * incrément se remarque plus que le chiffre lui-même.
 *
 * `href` est facultatif : un compteur qui mène quelque part est un lien, un
 * compteur qui ne mène nulle part ne doit pas s'annoncer comme cliquable.
 */
export function Stat({
  icon: Icon,
  chip,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  /** La paire ton + encre de la pastille, p. ex. `"bg-zest text-on-zest"`. */
  chip: string;
  label: string;
  value: number | string;
  href?: string;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", chip)}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="stat text-stat">{value}</span>
        <span className="mt-1.5 text-meta text-muted-foreground">{label}</span>
      </span>
    </>
  );

  if (!href) {
    return <div className="flex items-center gap-3">{body}</div>;
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl transition-opacity hover:opacity-80"
    >
      {body}
    </Link>
  );
}

/** La rangée. Elle se range au bout de la ligne de titre sur grand écran. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-7 gap-y-4">{children}</div>;
}
