"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { BadgeProps } from "@/components/ui/badge";

export const STATUS_LABEL: Record<string, string> = {
  new: "Nouveau",
  enriched: "Enrichi",
  scored: "Scoré",
  enrolled: "En séquence",
  engaged: "A répondu",
  booked: "RDV",
  won: "Signé",
  lost: "Perdu",
  suppressed: "Exclu",
};

export const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  new: "outline",
  enriched: "outline",
  scored: "secondary",
  enrolled: "secondary",
  engaged: "warning",
  booked: "success",
  won: "success",
  lost: "outline",
  suppressed: "destructive",
};

const FILTERS = [
  "tous",
  "scored",
  "enrolled",
  "engaged",
  "booked",
  "won",
  "lost",
  "suppressed",
] as const;

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
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={query}
          placeholder="Rechercher…"
          className="pl-9"
          onKeyDown={(event) => {
            if (event.key === "Enter") setParam("q", event.currentTarget.value);
          }}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => setParam("statut", status)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              current === status
                ? "bg-secondary text-secondary-foreground"
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
