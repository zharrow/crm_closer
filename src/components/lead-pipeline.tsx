import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

/**
 * Le parcours d'un prospect, rendu comme le parcours qu'il est.
 *
 * `leadStatus` est écrit dans l'ordre en base (`schema.ts`) : six étapes
 * qui se suivent, puis trois sorties. La fiche n'en montrait qu'une
 * pastille plate — on savait où le prospect en est, jamais d'où il vient
 * ni ce qui l'attend. C'est le seul endroit de l'app où une séquence
 * réelle était aplatie en un mot.
 *
 * Le dispositif n'est donc pas décoratif : il encode une progression qui
 * existe. C'est la réserve que pose le principe des repères numérotés —
 * ne baliser une suite que si l'ordre porte une information — et elle est
 * remplie ici.
 */
const STEPS = [
  { key: "new", label: "Nouveau" },
  { key: "enriched", label: "Enrichi" },
  { key: "scored", label: "Scoré" },
  { key: "enrolled", label: "En séquence" },
  { key: "engaged", label: "A répondu" },
  { key: "booked", label: "RDV" },
] as const;

export type PipelineStep = (typeof STEPS)[number]["key"];

/**
 * Les trois sorties ne sont pas des étapes : on n'y « progresse » pas, on
 * y aboutit. Elles se rendent en fin de piste, pas dessus.
 */
const OUTCOMES = {
  won: { label: "Signé", variant: "success" },
  lost: { label: "Perdu", variant: "outline" },
  suppressed: { label: "Exclu", variant: "destructive" },
} as const;

type Outcome = keyof typeof OUTCOMES;

function isOutcome(status: string): status is Outcome {
  return status in OUTCOMES;
}

/** Jours pleins écoulés, frontières de journée locale — pas des tranches de 24 h. */
function daysSince(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const midnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((midnight(new Date()) - midnight(new Date(value))) / 86_400_000);
}

function sinceLabel(value: Date | string | null | undefined): string | null {
  const days = daysSince(value);
  if (days === null) return null;
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "depuis hier";
  return `depuis ${days} j`;
}

export function LeadPipeline({
  status,
  dates,
}: {
  status: string;
  /**
   * La date d'entrée de chaque étape, quand la base la connaît.
   *
   * Elle ne les connaît pas toutes, et rien n'est inventé pour combler :
   * `createdAt`, `enrichedAt` et `scoredAt` sont des colonnes de `leads` ;
   * l'inscription se lit à la première action créée pour ce prospect, la
   * réponse au premier message entrant. Le RDV, lui, n'est horodaté nulle
   * part — l'étape s'affiche donc sans date plutôt qu'avec une
   * approximation. Une date fausse se lit comme une date vraie.
   */
  dates: Partial<Record<PipelineStep, Date | string | null>>;
}) {
  const outcome = isOutcome(status) ? status : null;
  const currentIndex = outcome ? -1 : STEPS.findIndex((step) => step.key === status);

  /**
   * Une étape est franchie si on est passé au-delà, *ou* si elle a laissé
   * une date derrière elle.
   *
   * Le second cas n'est pas une redondance : le statut courant dit où le
   * prospect en est aujourd'hui, pas jusqu'où il était allé. Un prospect
   * perdu ou exclu a quitté la piste à un endroit que seul son horodatage
   * raconte — sans cette règle, une fiche « Perdu » afficherait une piste
   * entièrement vierge, comme si rien n'avait eu lieu.
   */
  const reached = (index: number) =>
    (currentIndex >= 0 && index < currentIndex) || Boolean(dates[STEPS[index]!.key]);

  return (
    <section aria-label="Progression du prospect" className="flex flex-col gap-3">
      {/* La piste déborde sous les écrans étroits plutôt que de se replier :
          six étapes empilées à la verticale prennent la moitié de la fiche
          pour dire une chose qui se lit d'un trait. Le débordement reste
          dans son propre conteneur — la page, elle, ne défile jamais
          latéralement. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-max gap-3 sm:min-w-0">
          {STEPS.map((step, index) => {
            const done = reached(index);
            const current = index === currentIndex;
            const caption = current
              ? sinceLabel(dates[step.key])
              : done
                ? dates[step.key]
                  ? formatDate(dates[step.key])
                  : null
                : null;

            return (
              <li key={step.key} className="flex min-w-28 flex-1 flex-col gap-2">
                <div className="flex items-center gap-1.5 leading-5">
                  {/* Le vert dit « acquis, obtenu » — c'est exactement ce
                      qu'est une étape franchie. Le point plein de l'étape
                      courante reste en encre neutre : c'est le trait sous
                      le libellé qui porte le zeste, et deux marques zestées
                      à quatre pixels d'écart feraient une tache. */}
                  {done ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                  ) : current ? (
                    <span
                      aria-hidden
                      /* À 1,5 le point était plus petit que les coches des
                         étapes déjà franchies : le présent pesait moins que
                         le passé, exactement à l'envers de ce qu'on cherche
                         à lire. Il est calé sur la hauteur d'une coche. */
                      className="h-2 w-2 shrink-0 rounded-full bg-foreground"
                    />
                  ) : (
                    <span aria-hidden className="h-2 w-2 shrink-0" />
                  )}
                  <span
                    className={cn(
                      "text-meta",
                      /* Franchie et à venir se distinguent par le trait et
                         la coche, jamais par une opacité sur le texte :
                         `--muted-foreground` est calé à 7,0:1 pile, et le
                         moindre voile le ferait passer sous le plancher. */
                      current ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  {current && <span className="sr-only">— étape en cours</span>}
                </div>

                <span
                  aria-hidden
                  className={cn(
                    "h-1 rounded-full",
                    /* Trois poids décroissants : l'étape en cours en
                       zeste — le ton du présent, le même que la pilule
                       active du rail —, la franchie en vert affaibli,
                       celle à venir plus légère que tout le reste.
                       `--border` à pleine force faisait peser le futur plus
                       lourd que le passé : sur une fiche « Perdu », les
                       trois étapes jamais atteintes se lisaient comme les
                       plus marquées de la piste. */
                    current ? "bg-zest" : done ? "bg-success/45" : "bg-border/40",
                  )}
                />

                {/* La ligne de légende est toujours rendue, vide au besoin :
                    sans elle, les traits de deux colonnes voisines ne
                    s'alignent plus dès qu'une seule porte une date. */}
                {/* « depuis 6 j » se rend en pleine encre, les dates
                    franchies en gris : six légendes du même poids se
                    lisent comme un relevé, alors qu'une seule répond à la
                    question qu'on se pose en ouvrant la fiche — est-ce que
                    ça traîne ? */}
                <span
                  className={cn(
                    "numeric text-meta",
                    current ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {caption ?? " "}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {outcome && (
        <p className="flex items-center gap-2 text-meta text-muted-foreground">
          <span>Sortie&nbsp;:</span>
          <Badge variant={OUTCOMES[outcome].variant}>{OUTCOMES[outcome].label}</Badge>
        </p>
      )}
    </section>
  );
}
