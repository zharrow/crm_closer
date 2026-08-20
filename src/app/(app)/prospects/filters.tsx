"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "@/components/animate-ui/icons/search";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { STATUS_FILTERS, STATUS_LABEL } from "@/lib/lead-status";

export function StatusFilter({ current, query }: { current: string; query: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "tous") next.set(key, value);
    else next.delete(key);
    router.push(`/prospects?${next.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative sm:max-w-xs sm:flex-1">
        <label htmlFor="recherche-prospect" className="sr-only">
          Rechercher un prospect par entreprise, ville ou email
        </label>
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="recherche-prospect"
          type="search"
          enterKeyHint="search"
          defaultValue={query}
          /* La touche Entrée est ce qui déclenche la recherche : autant le
             dire, il n'y a pas de bouton pour le laisser deviner. */
          placeholder="Rechercher, puis Entrée"
          className="pl-9"
          onKeyDown={(event) => {
            if (event.key === "Enter") setParam("q", event.currentTarget.value);
          }}
        />
      </div>

      {/* `aria-pressed` plutôt que la seule couleur de fond : sinon le
          filtre actif ne se distingue qu'à l'œil, et pas du tout au
          lecteur d'écran. */}
      <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={current === status}
            onClick={() => setParam("statut", status)}
            /* Le filtre actif passe en aplat encre. Il était en
               `--secondary` : un beige à 4 % du fond, invisible dès qu'on
               ne fixait pas la rangée — et `aria-pressed` faisait tout le
               travail pour le lecteur d'écran pendant que l'œil, lui,
               n'avait rien. L'encre ne signale rien par elle-même, ce qui
               est exactement ce qu'il faut : « je filtre là-dessus » est
               une position, pas une action ni un état du prospect. */
            className={cn(
              "rounded-full px-3.5 py-1.5 text-meta font-medium transition-colors",
              current === status
                ? "bg-ink text-on-ink"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {status === "tous" ? "Tous" : STATUS_LABEL[status]}
          </button>
        ))}
      </div>
    </div>
  );
}
