"use client";

import { useEffect, useState } from "react";
import { TaskCard, type TaskCardData } from "./task-card";

/** Même mécanisme que `ScrollMemory` : la place qu'on avait, rendue au retour. */
const STORAGE_KEY = "file:action-ouverte";

/**
 * La file du jour, une action ouverte à la fois.
 *
 * Toutes les cartes dépliées en même temps, la journée ne se voyait pas :
 * sept actions faisaient plusieurs écrans de haut, et il fallait défiler
 * pour savoir combien il en restait. Repliées, elles tiennent ensemble —
 * on sait ce qu'on a devant soi avant de commencer.
 *
 * L'accordéon est ici et non dans la carte parce qu'il n'y a qu'une seule
 * action ouverte pour toute la file : c'est un état commun, il se tient au
 * seul endroit qui les voit toutes.
 *
 * Les cartes restent montées une fois repliées ; leurs brouillons retouchés
 * survivent donc au repli.
 */
export function TaskQueue({
  late,
  today,
}: {
  late: TaskCardData[];
  today: TaskCardData[];
}) {
  // Le retard d'abord : c'est ce qui a déjà attendu.
  const [openId, setOpenId] = useState<string | null>(
    late[0]?.id ?? today[0]?.id ?? null,
  );

  /**
   * On restaure après le premier rendu, pas pendant.
   *
   * `sessionStorage` n'existe pas sur le serveur : le lire dans l'état
   * initial ferait diverger le rendu serveur du rendu client, et React
   * signalerait l'écart. Le prix est un rendu de plus, invisible.
   *
   * Sans ça, ouvrir la troisième action, aller voir la fiche du prospect et
   * revenir rouvrait la première — alors que la position de défilement, elle,
   * était bien rendue. On atterrissait donc au bon endroit devant la mauvaise
   * carte.
   */
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    // L'action a pu être envoyée ou reportée entre-temps : on ne rouvre que
    // ce qui est encore dans la file.
    const stillHere = [...late, ...today].some((task) => task.id === saved);
    if (stillHere) setOpenId(saved);
    else sessionStorage.removeItem(STORAGE_KEY);
    // Au montage seulement : ensuite c'est `toggle` qui fait autorité.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) =>
    setOpenId((current) => {
      const next = current === id ? null : id;
      if (next) sessionStorage.setItem(STORAGE_KEY, next);
      else sessionStorage.removeItem(STORAGE_KEY);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {late.length > 0 && (
        <>
          <GroupHeading label="En retard" count={late.length} tone="late" />
          {late.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              late
              expanded={openId === task.id}
              onToggle={() => toggle(task.id)}
            />
          ))}
        </>
      )}

      {today.length > 0 && (
        <>
          <GroupHeading
            label="Aujourd'hui"
            count={today.length}
            tone="today"
            /* Pas de filet au-dessus du premier groupe : il ne séparerait
               rien. */
            spaced={late.length > 0}
          />
          {today.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              late={false}
              expanded={openId === task.id}
              onToggle={() => toggle(task.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}

/**
 * Le retard était rendu par une nuance de rouge sur une date, au milieu
 * d'une pile de cartes identiques : à l'œil, rien ne le distinguait. En
 * faire une section le sort de la couleur et le met dans la structure.
 */
function GroupHeading({
  label,
  count,
  tone,
  spaced,
}: {
  label: string;
  count: number;
  tone: "late" | "today";
  spaced?: boolean;
}) {
  return (
    <h2
      className={`flex items-center gap-3 text-meta font-semibold uppercase tracking-wide ${
        spaced ? "mt-5" : ""
      } ${tone === "late" ? "text-destructive" : "text-muted-foreground"}`}
    >
      <span>
        {label} · <span className="tabular-nums">{count}</span>
      </span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </h2>
  );
}
