"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { FieldStatus, useSaveField } from "./inline-field";

/**
 * Un texte qui se lit, et qui s'ouvre quand on veut le reprendre.
 *
 * Les trois champs de « Ton offre » étaient trois zones de saisie ouvertes
 * en permanence, chacune tronquée à trois lignes : on voyait des bouts de
 * paragraphes coupés au milieu d'une phrase, dans des cadres qui appelaient
 * à écrire alors qu'on venait relire. Ils sont pourtant le contraire d'un
 * champ de formulaire ordinaire — on les écrit une fois, on les relit
 * souvent.
 *
 * D'où le bloc cité. Ce n'est pas un fond décoratif : ces trois textes
 * partent **tels quels** dans chaque message rédigé par le modèle. Les
 * rendre comme une citation dit ce qu'ils sont — du texte repris mot pour
 * mot ailleurs — au lieu de les déguiser en réglages.
 *
 * Entrée enregistre. Le retour à la ligne passe donc sur Maj+Entrée, et
 * Échap annule : trois touches annoncées sous le champ pendant qu'on écrit,
 * parce qu'un raccourci qu'on doit deviner n'existe pas.
 */
export function InlineText({
  name,
  label,
  defaultValue,
  placeholder,
  id,
  "aria-describedby": describedBy,
}: {
  name: string;
  /** Repris dans le nom accessible du crayon : « Modifier — Ce que tu proposes ». */
  label: string;
  defaultValue: string;
  placeholder: string;
  id?: string;
  "aria-describedby"?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [draft, setDraft] = useState(defaultValue);
  const [editing, setEditing] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const { status, error, save } = useSaveField(name);

  useEffect(() => {
    if (!editing) return;
    const el = field.current;
    if (!el) return;
    el.focus();
    // Le curseur à la fin, pas au début : on vient reprendre un texte
    // existant, pas le réécrire depuis zéro.
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const open = () => {
    setDraft(value);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  /**
   * Enregistre ce seul champ.
   *
   * Il soumettait auparavant le formulaire entier, faute d'action serveur
   * propre à un réglage — ce qui avait le mérite de n'avoir qu'une seule
   * validation, et le défaut d'emporter au passage les autres champs en
   * cours de modification. `saveSetting` conserve le mérite et supprime le
   * défaut : la table de validation reste unique, côté serveur, et l'écriture
   * ne porte que sur la clé demandée.
   */
  const commit = async () => {
    const next = draft.trim();
    setEditing(false);

    if (next === value) return;

    const stored = await save(next);
    // Échec : on garde le texte à l'écran plutôt que de le jeter. Ce qui
    // manque, c'est l'enregistrement, pas la rédaction.
    const shown = stored === null ? next : String(stored);
    setValue(shown);
    setDraft(shown);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    // Maj+Entrée garde son sens ordinaire : une ligne de plus.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void commit();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {editing ? (
        <>
          <Textarea
            ref={field}
            id={id}
            aria-describedby={describedBy}
            rows={6}
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            className="resize-y"
          />
          <p className="flex flex-wrap items-center gap-x-1 text-meta text-muted-foreground">
            <kbd className="font-sans font-medium text-foreground">Entrée</kbd> enregistre
            {" · "}
            <kbd className="font-sans font-medium text-foreground">Maj+Entrée</kbd> va à la
            ligne
            {" · "}
            <kbd className="font-sans font-medium text-foreground">Échap</kbd> annule
            <FieldStatus status={status} error={error} className="ml-auto" />
          </p>
        </>
      ) : (
        /* ---- Le bloc cité, au repos ---------------------------------
           Deux corrections par rapport à la version d'avant.

           **La cible est le bloc entier.** Seul le crayon ouvrait
           l'éditeur : il fallait viser une icône de 16 px, alors que le
           texte à reprendre occupe toute la largeur juste à côté. C'est
           exactement la règle posée pour les champs d'une ligne, et ce
           bloc-ci ne la respectait pas.

           **Rien au repos.** Le bloc a porté successivement un aplat
           `bg-muted`, puis un filet à gauche censé le faire lire comme une
           citation. Les deux disaient la même chose de trop : que ce texte
           est un *champ*. Il n'en est pas un — on vient le relire bien plus
           souvent qu'on ne le réécrit.

           Il ne reste donc que le texte, et le fond n'apparaît qu'au survol,
           exactement comme les champs d'une ligne de cette page. Le rendu
           particulier de ces trois-là ne tient plus à une décoration mais à
           ce qu'ils sont : du texte long, à `text-body`, avec ses retours à
           la ligne conservés. */
        <div className="flex items-start gap-2">
          <button
            type="button"
            id={id}
            aria-describedby={describedBy}
            onClick={open}
            className="group flex min-w-0 flex-1 items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted"
          >
            {value ? (
              /* `whitespace-pre-wrap` : ces textes portent des retours à la
                 ligne qui comptent — les réalisations sont une par ligne. */
              <span className="min-w-0 flex-1 whitespace-pre-wrap text-body leading-relaxed">
                {value}
              </span>
            ) : (
              <span className="min-w-0 flex-1 text-body leading-relaxed text-muted-foreground">
                Rien pour l&apos;instant. Le modèle rédigera sans cet élément, donc plus
                faiblement.
              </span>
            )}

            <Pencil
              className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-60"
              aria-hidden
            />
            <span className="sr-only">Modifier — {label}</span>
          </button>

          <FieldStatus status={status} error={error} className="mt-2" />
        </div>
      )}
    </div>
  );
}
