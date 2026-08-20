"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveSetting } from "./actions";

/**
 * L'enregistrement, champ par champ.
 *
 * La page avait un formulaire et un bouton « Enregistrer » tout en bas. Sur
 * un écran de plusieurs hauteurs, ça produit deux défauts qu'on ne remarque
 * qu'à l'usage : on modifie un prénom en haut, on ne descend pas, on part —
 * et rien n'a été écrit ; ou bien on clique et on ne sait pas *ce qui* a été
 * enregistré, puisque le bouton parle pour douze champs à la fois.
 *
 * Chaque champ s'enregistre donc seul, au moment où on le quitte. Le prix à
 * payer est qu'il n'y a plus de moment « je valide » : la confirmation doit
 * venir du champ lui-même, sinon on ne sait jamais si c'est parti. D'où
 * l'indicateur ci-dessous, qui est le pendant obligatoire de la suppression
 * du bouton — pas une décoration.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useSaveField(name: string) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Le minuteur survit au démontage si on ne le coupe pas : React
     signalerait une mise à jour sur un composant disparu, et en
     développement le Strict Mode le fait remarquer deux fois. */
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /**
   * Renvoie ce que la base a réellement retenu, ou `null` si l'écriture a
   * échoué. Le nettoyage côté serveur peut changer la valeur — une espace
   * de trop, un seuil hors bornes — et l'écran doit montrer ce qui est
   * stocké, pas ce qu'on croit avoir tapé.
   */
  const save = async (raw: unknown) => {
    setStatus("saving");
    setError(null);

    const result = await saveSetting(name, raw);

    if (result.error) {
      setStatus("error");
      setError(result.error);
      return null;
    }

    setStatus("saved");
    if (timer.current) clearTimeout(timer.current);
    // Assez long pour être vu, assez court pour ne pas s'installer.
    timer.current = setTimeout(() => setStatus("idle"), 2400);
    return result.value ?? null;
  };

  return { status, error, save };
}

/**
 * L'état d'un champ, en trois mots au plus.
 *
 * « Enregistré » s'efface, l'erreur reste : un succès qu'on rate n'a pas
 * de conséquence, un échec qu'on rate en a une.
 */
export function FieldStatus({
  status,
  error,
  className,
}: {
  status: SaveStatus;
  error?: string | null;
  className?: string;
}) {
  if (status === "idle") return null;

  return (
    <span
      /* `role="status"` : l'enregistrement se produit sans qu'on l'ait
         demandé explicitement, donc il doit être annoncé. `polite` pour ne
         pas couper ce qui est en cours de lecture. */
      role="status"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-meta",
        status === "error" ? "font-medium text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Enregistrement…
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
          Enregistré
        </>
      )}
      {status === "error" && (
        <>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {error ?? "Non enregistré"}
        </>
      )}
    </span>
  );
}

/**
 * La ligne au repos : du texte, pas un contrôle.
 *
 * C'est la décision de fond de cet écran. Une page de réglages remplie de
 * champs bordés en permanence *demande* qu'on écrive dedans, alors qu'on
 * vient presque toujours relire. Au repos, la valeur se lit donc comme du
 * texte ; le fond n'apparaît qu'au survol, et le crayon avec lui.
 *
 * La cible est la ligne entière et non le crayon : viser une icône de
 * 16 px pour reprendre un texte est un jeu d'adresse, pas une interface.
 */
function RestingRow({
  children,
  onOpen,
  label,
  status,
  error,
}: {
  children: React.ReactNode;
  onOpen: () => void;
  label: string;
  status: SaveStatus;
  error?: string | null;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted"
      >
        <span className="min-w-0 flex-1 truncate text-body">{children}</span>
        {/* Le crayon se cache tant qu'on ne pointe pas : c'est ce qui fait
            que la page se lit comme un document et non comme un formulaire.
            Mais sur un appareil sans survol, « tant qu'on ne pointe pas »
            veut dire « jamais » — l'affordance disparaîtrait pour de bon. Le
            média `hover: none` le rend donc permanent là où il le faut. */}
        <Pencil
          className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-60"
          aria-hidden
        />
        <span className="sr-only">Modifier — {label}</span>
      </button>
      <FieldStatus status={status} error={error} />
    </div>
  );
}

/**
 * Un réglage d'une ligne : prénom, lien, nombre.
 *
 * Entrée enregistre, Échap annule, et quitter le champ enregistre aussi —
 * parce que c'est ce que fait la moitié des gens et qu'un texte perdu pour
 * n'avoir pas appuyé sur la bonne touche est impardonnable.
 */
export function InlineInput({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  id,
  "aria-describedby": describedBy,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  type?: "text" | "url" | "number";
  id?: string;
  "aria-describedby"?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [draft, setDraft] = useState(defaultValue);
  const [editing, setEditing] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  /* Échap ferme le champ, ce qui déclenche `blur` — et `blur` enregistre.
     Sans ce drapeau, annuler enregistrerait. */
  const cancelling = useRef(false);
  const { status, error, save } = useSaveField(name);

  useEffect(() => {
    if (!editing) return;
    const el = field.current;
    if (!el) return;
    el.focus();
    // On vient reprendre une valeur, pas la réécrire : curseur à la fin.
    if (type !== "number") el.setSelectionRange(el.value.length, el.value.length);
  }, [editing, type]);

  const commit = async () => {
    if (cancelling.current) {
      cancelling.current = false;
      return;
    }

    const next = draft.trim();
    setEditing(false);

    // Rien n'a bougé : pas d'écriture, et surtout pas de « Enregistré »
    // qui clignoterait pour rien à chaque fois qu'on ouvre puis referme.
    if (next === value) return;

    const stored = await save(next);
    /* En cas d'échec on garde à l'écran ce qui a été tapé : le texte n'est
       pas perdu, et l'indicateur dit qu'il n'est pas enregistré. Effacer la
       saisie pour « revenir à l'état stocké » serait exact et insupportable. */
    const shown = stored === null ? next : String(stored);
    setValue(shown);
    setDraft(shown);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelling.current = true;
      setDraft(value);
      setEditing(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={field}
          id={id}
          aria-describedby={describedBy}
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => void commit()}
          className="flex h-10 w-full min-w-0 flex-1 rounded-xl border border-input bg-muted/70 px-3 text-body"
        />
        <FieldStatus status={status} error={error} />
      </div>
    );
  }

  return (
    <RestingRow onOpen={() => setEditing(true)} label={label} status={status} error={error}>
      {/* Vide, on l'écrit — on ne montre pas le `placeholder` en gris. Un
          exemple grisé à la place d'une valeur se lit comme une valeur : on
          croit avoir renseigné son prénom parce qu'on voit « Florent ».
          L'exemple réapparaît dans le champ dès qu'on l'ouvre. */}
      {value || <span className="text-muted-foreground">Rien pour l&apos;instant</span>}
    </RestingRow>
  );
}

/**
 * Un choix parmi trois : le contrôle natif, qui enregistre au changement.
 *
 * Pas de mode lecture ici, contrairement aux champs libres. Un `select`
 * *est* déjà sa propre valeur : le déguiser en texte obligerait à un clic de
 * plus pour révéler un contrôle qui n'occupe pas plus de place que le texte
 * qu'il remplacerait.
 */
export function InlineSelect({
  name,
  defaultValue,
  options,
  id,
  "aria-describedby": describedBy,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  id?: string;
  "aria-describedby"?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const { status, error, save } = useSaveField(name);

  const change = async (next: string) => {
    const previous = value;
    // Optimiste : le contrôle natif a déjà bougé sous le doigt, le figer
    // le temps de l'aller-retour donnerait l'impression d'un clic raté.
    setValue(next);
    const stored = await save(next);
    if (stored === null) setValue(previous);
    else if (String(stored) !== next) setValue(String(stored));
  };

  return (
    <div className="flex items-center gap-2">
      <select
        id={id}
        aria-describedby={describedBy}
        value={value}
        onChange={(event) => void change(event.target.value)}
        className="flex h-10 w-full min-w-0 flex-1 rounded-xl border border-input bg-muted/70 px-3 text-dense"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldStatus status={status} error={error} />
    </div>
  );
}
