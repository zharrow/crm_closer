"use client";

import { useState } from "react";
import { TaskCard, type TaskCardData } from "./task-card";

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

  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

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
