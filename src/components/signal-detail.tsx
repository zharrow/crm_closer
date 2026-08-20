import { ExternalLink } from "lucide-react";
import { copyFor, enjeuFor } from "@/lib/signal-copy";

/**
 * Un signal, avec ce qui manquait : pourquoi c'en est un.
 *
 * La colonne n'affichait que le constat et son poids — « site injoignable
 * +35 ». C'est un relevé. Pour s'en servir dans un appel ou pour relire un
 * brouillon, il faut savoir *ce que ça coûte au prospect* et *ce qu'on lui
 * apporte* ; ces deux phrases existaient déjà dans le code mais ne
 * servaient qu'au prompt de rédaction, jamais à toi.
 *
 * Replié par défaut : la colonne de droite tient sa densité, et on ouvre le
 * signal dont on a besoin au moment où on en a besoin. `<details>` plutôt
 * qu'un état React — c'est du repli de contenu, le navigateur sait le faire,
 * et ça reste ouvrable sans JavaScript.
 */
export function SignalDetail({
  kind,
  label,
  weight,
  headcount,
}: {
  kind: string;
  label: string;
  weight: number;
  /** Décide si un enjeu juridique conditionné à un seuil peut être servi. */
  headcount: number | null;
}) {
  const copy = copyFor(kind);
  const enjeu = enjeuFor(kind, headcount);

  const head = (
    <>
      <span className="min-w-0 flex-1 leading-relaxed">{label}</span>
      <span className="numeric shrink-0 text-muted-foreground">+{weight}</span>
    </>
  );

  // Un signal sans rédaction associée reste une ligne : rien à déplier.
  if (!copy) {
    return <li className="flex items-start justify-between gap-3">{head}</li>;
  }

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer items-start justify-between gap-3 rounded-md py-0.5 transition-colors hover:text-foreground">
          {head}
        </summary>

        <div className="mt-2 flex flex-col gap-2 border-l-2 border-border pl-3 text-meta leading-relaxed">
          {enjeu && (
            <p>
              <span className="eyebrow text-muted-foreground">Ce que ça lui coûte</span>
              <br />
              {enjeu}
            </p>
          )}

          <p>
            <span className="eyebrow text-muted-foreground">Ce que tu apportes</span>
            <br />
            {copy.geste}
          </p>

          {/* La source est affichée entière — libellé *et* portée. Un chiffre
              cité hors de son périmètre devient faux : l'étude Deloitte porte
              sur 37 grandes marques, pas sur le salon d'en face, et la ligne
              qui le rappelle est ce qui empêche de la citer de travers. */}
          {copy.source && (
            <p className="text-muted-foreground">
              <a
                href={copy.source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                {copy.source.label}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              <br />
              {copy.source.portee}
            </p>
          )}
        </div>
      </details>
    </li>
  );
}
