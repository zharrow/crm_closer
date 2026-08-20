import { cn, formatDate } from "@/lib/utils";

/**
 * Le rythme, en colonnes de points.
 *
 * Le dispositif vient de `inspiration/` — une colonne par jour, un point par
 * unité, deux séries dont l'une est ghostée. Il n'a pas été repris pour son
 * allure : c'est la seule forme qui rende une petite série quotidienne
 * *comptable à l'œil*. Sur une barre, « 4 » et « 5 » se ressemblent ; en
 * points, on les compte sans les lire. Pour une file de travail où les
 * volumes quotidiens tiennent sur les doigts d'une main, c'est exactement
 * la bonne précision.
 *
 * Les deux séries ne sont pas décoratives non plus, et c'est ce qui a décidé
 * de sa présence :
 *
 * — **envoyé** (`doneAt`) : ce qui est parti, un fait acquis, donc `--success` ;
 * — **prévu** (`dueAt`, encore en attente) : ce qui reste dû, donc le ton
 *   ambre de l'attente.
 *
 * D'où la lecture qui justifie tout le reste : des points ambre sur un jour
 * **passé** sont du retard, et ils se voient sans qu'on ait à les chercher.
 * Sur les jours à venir, les mêmes points annoncent la charge.
 */
export interface RhythmDay {
  /** Minuit local de ce jour-là. */
  date: Date;
  sent: number;
  due: number;
}

/**
 * Hauteur maximale d'une colonne, en points.
 *
 * Au-delà, un point vaut plusieurs actions. Ce n'est pas un détail qu'on
 * peut taire : un graphique dont l'unité change sans le dire ment. La
 * légende l'écrit dès que le facteur dépasse 1.
 */
const MAX_DOTS = 12;

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function RhythmChart({ days }: { days: RhythmDay[] }) {
  const today = new Date();
  const peak = Math.max(1, ...days.map((day) => Math.max(day.sent, day.due)));
  // Un point vaut `unit` actions. À faible volume — le cas courant — il en
  // vaut une, et la colonne se compte littéralement.
  const unit = Math.ceil(peak / MAX_DOTS);
  const rows = Math.min(MAX_DOTS, peak);

  const dotsFor = (value: number) => (value === 0 ? 0 : Math.max(1, Math.round(value / unit)));

  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-2 text-meta text-muted-foreground">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-success" />
          Envoyé
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-amber" />
          Encore dû
        </span>
        {unit > 1 && (
          <span className="numeric">
            1 point = {unit} actions
          </span>
        )}
      </figcaption>

      {/* Le graphique déborde plutôt que de comprimer ses colonnes : trente
          jours écrasés dans 300 px ne se comptent plus, et compter est tout
          ce qu'on lui demande. Le débordement reste dans son conteneur — la
          page, elle, ne défile jamais latéralement. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol
          /* Une liste, et chaque jour porte son intitulé complet : le
             graphique est illisible sans les yeux, l'énoncé ne l'est pas. */
          className="flex min-w-max items-end gap-1 sm:min-w-0"
        >
          {days.map((day) => {
            const current = isSameDay(day.date, today);
            const future = day.date > today && !current;
            const sentDots = dotsFor(day.sent);
            const dueDots = dotsFor(day.due);

            return (
              <li
                key={day.date.toISOString()}
                aria-label={`${formatDate(day.date)} : ${day.sent} envoyée${
                  day.sent > 1 ? "s" : ""
                }, ${day.due} encore due${day.due > 1 ? "s" : ""}`}
                className="flex min-w-6 flex-1 flex-col items-center gap-2"
              >
                {/* `flex-col-reverse` : la colonne se remplit par le bas,
                    comme une pile réelle. Sa hauteur est réservée même vide,
                    sinon les colonnes ne partagent pas la même ligne de sol
                    et le graphique ondule. */}
                <div
                  className="flex flex-col-reverse items-center gap-1"
                  style={{ height: `calc(${rows} * 0.5rem + ${rows - 1} * 0.25rem)` }}
                >
                  {Array.from({ length: sentDots }).map((_, i) => (
                    <span key={`s${i}`} aria-hidden className="h-2 w-2 rounded-full bg-success" />
                  ))}
                  {Array.from({ length: dueDots }).map((_, i) => (
                    <span key={`d${i}`} aria-hidden className="h-2 w-2 rounded-full bg-amber" />
                  ))}
                  {sentDots === 0 && dueDots === 0 && (
                    /* Un jour à zéro n'est pas un trou : c'est un jour sans
                       rien à faire. Le point creux le dit, l'absence
                       laisserait croire à une donnée manquante. */
                    <span aria-hidden className="h-2 w-2 rounded-full bg-border/50" />
                  )}
                </div>

                {/* Aujourd'hui porte le zeste — le ton du présent, le même
                    que la pilule active du rail. Les autres jours n'écrivent
                    leur date qu'un sur cinq : trente étiquettes se
                    chevauchent et plus aucune ne se lit. */}
                <span
                  className={cn(
                    "numeric text-meta leading-none",
                    current
                      ? "rounded-full bg-zest px-1.5 py-0.5 font-medium text-on-zest"
                      : future
                        ? "text-muted-foreground/70"
                        : "text-muted-foreground",
                  )}
                >
                  {current ? "auj." : day.date.getDate() % 5 === 0 ? day.date.getDate() : " "}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </figure>
  );
}
