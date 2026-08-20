"use client";

import { useEffect, useState, useTransition } from "react";
import { FieldStatus, useSaveField } from "./inline-field";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertTriangle, Circle, Loader2 } from "lucide-react";
import { Check } from "@/components/animate-ui/icons/check";
import { Play } from "@/components/animate-ui/icons/play";
import { Plus } from "@/components/animate-ui/icons/plus";
import { RotateCcw } from "@/components/animate-ui/icons/rotate-ccw";
import { Sparkles } from "@/components/animate-ui/icons/sparkles";
import { X } from "@/components/animate-ui/icons/x";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { QuerySuggestion, Settings } from "@/db/schema";
import type { CycleEvent, CycleReport, CycleStep } from "@/lib/daily-cycle";
import type { QueryYield, ThresholdOption } from "@/lib/query-suggestions";
import { acceptSuggestion, dismissSuggestion, restoreSuggestion, suggestQueries } from "./actions";

/** Ce qu'une requête Places ramène au maximum : 2 pages de 20. */
const PLACES_PER_QUERY = 40;

const STEP_ORDER: CycleStep[] = ["sourcing", "enroll"];

const STEP_TITLES: Record<CycleStep, string> = {
  sourcing: "Sourcing Google Places",
  enroll: "Inscription en séquence",
};

/** L'état de l'étape en mots : l'icône seule ne s'annonce pas. */
const STEP_STATUS_LABEL: Record<StepState["status"], string> = {
  pending: "en attente",
  running: "en cours",
  done: "terminé",
  error: "erreur",
};

interface StepState {
  status: "pending" | "running" | "done" | "error";
  /** Ce que l'étape va faire, annoncé avant de la faire. */
  expect: string;
  /** Ce qui se passe à l'instant, puis le résultat obtenu. */
  detail: string;
  done: number | null;
  total: number | null;
}

function idleSteps(): Record<CycleStep, StepState> {
  const blank: StepState = { status: "pending", expect: "", detail: "", done: null, total: null };
  return { sourcing: { ...blank }, enroll: { ...blank } };
}

function splitQueries(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * La carte de sourcing, lue de haut en bas comme l'entonnoir qu'elle
 * décrit : ce qu'on cherche, ce que ça donne réellement, puis ce que le
 * modèle propose d'essayer ensuite.
 *
 * Le tableau est placé **avant** les propositions parce qu'il en est la
 * justification : sous une liste de douze suggestions, personne ne le
 * voyait. Les requêtes sont des lignes et non un bloc de texte libre,
 * pour que « Ajouter » ait un effet visible au lieu d'un simple toast.
 */
export function SourcingCard({
  settings,
  initialSuggestions,
  initialDismissed,
  yields,
  thresholds,

}: {
  settings: Settings;
  initialSuggestions: QuerySuggestion[];
  initialDismissed: QuerySuggestion[];
  yields: QueryYield[];
  thresholds: ThresholdOption[];
  /** Horodatage de la dernière sauvegarde réussie, 0 si aucune. */
}) {
  const [queries, setQueries] = useState(() => splitQueries(settings.placesQueries));
  const [draft, setDraft] = useState("");
  const [enabled, setEnabled] = useState(settings.sourcingEnabled);
  const [threshold, setThreshold] = useState(settings.minEnrollScore);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [dismissed, setDismissed] = useState(initialDismissed);
  const [showDismissed, setShowDismissed] = useState(false);
  const [report, setReport] = useState<CycleReport | null>(null);
  const [steps, setSteps] = useState<Record<CycleStep, StepState> | null>(null);
  const [cycling, setCycling] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const busy = pending || cycling;

  /**
   * Tout s'enregistre au moment où on le change.
   *
   * Cette carte tenait une « référence » de ce qui avait été enregistré, la
   * comparait à l'écran, et en tirait un état « modifié » qui verrouillait
   * le bouton de cycle — trente lignes pour rattraper le décalage entre ce
   * qu'on voit et ce qui est en base. Le décalage n'existe plus : il n'y a
   * plus de bouton « Enregistrer », donc plus d'écart possible entre les
   * deux. La machinerie a été retirée avec lui.
   *
   * Trois réglages écrivent depuis ici, et chacun a son indicateur : on doit
   * pouvoir dire lequel vient de partir.
   */
  const enabledField = useSaveField("sourcingEnabled");
  const queriesField = useSaveField("placesQueries");
  const thresholdField = useSaveField("minEnrollScore");

  const changeEnabled = (next: boolean) => {
    setEnabled(next);
    void enabledField.save(next).then((stored) => {
      if (stored === null) setEnabled(!next);
    });
  };

  /* La liste part en bloc : c'est une seule colonne en base, et l'ajout
     comme le retrait la réécrivent en entier. */
  const commitQueries = (next: string[]) => {
    setQueries(next);
    void queriesField.save(next.join("\n"));
  };

  const changeThreshold = (next: number) => {
    setThreshold(next);
    void thresholdField.save(next);
  };

  const addQuery = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    if (queries.some((q) => q.toLowerCase() === clean.toLowerCase())) {
      toast.info("Cette requête est déjà dans la liste.");
      return;
    }
    commitQueries([...queries, clean]);
  };

  const propose = () =>
    startTransition(async () => {
      const result = await suggestQueries();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSuggestions(result.suggestions ?? []);
      toast.success(
        result.added
          ? `${result.added} proposition${result.added > 1 ? "s" : ""}`
          : "Rien de neuf : tout ce que le modèle voit est déjà dans ta liste ou a été écarté.",
      );
    });

  const accept = (suggestion: QuerySuggestion) =>
    startTransition(async () => {
      addQuery(suggestion.query);
      setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
      const result = await acceptSuggestion(suggestion.id);
      if (result.error) toast.error(result.error);
    });

  const dismiss = (suggestion: QuerySuggestion) =>
    startTransition(async () => {
      setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
      setDismissed((prev) => [suggestion, ...prev]);
      const result = await dismissSuggestion(suggestion.id);
      if (result.error) toast.error(result.error);
    });

  const restore = (suggestion: QuerySuggestion) =>
    startTransition(async () => {
      setDismissed((prev) => prev.filter((item) => item.id !== suggestion.id));
      setSuggestions((prev) => [suggestion, ...prev]);
      const result = await restoreSuggestion(suggestion.id);
      if (result.error) toast.error(result.error);
      else toast.success("Remise dans les propositions.");
    });

  const applyEvent = (event: CycleEvent) => {
    if (event.type === "done") {
      setReport(event.report);
      if (event.report.errors.length > 0) {
        toast.error(`Cycle terminé avec ${event.report.errors.length} erreur(s).`);
      } else {
        toast.success("Cycle terminé.");
      }
      return;
    }

    setSteps((prev) => {
      if (!prev) return prev;
      const current = prev[event.step];
      const next = { ...prev };

      if (event.type === "start") {
        next[event.step] = {
          status: "running",
          expect: event.label,
          detail: "",
          done: 0,
          total: event.total,
        };
      } else if (event.type === "advance") {
        next[event.step] = {
          ...current,
          status: "running",
          detail: event.label,
          done: event.done,
          total: event.total,
        };
      } else if (event.type === "finish") {
        next[event.step] = { ...current, status: "done", detail: event.label };
      } else {
        next[event.step] = { ...current, status: "error", detail: event.message };
      }

      return next;
    });
  };

  /**
   * Le cycle est lu au fil de l'eau, une ligne de JSON par événement.
   *
   * Pas de `startTransition` ici : les mises à jour d'une transition sont
   * volontairement de basse priorité, et une barre de progression qui
   * saute des étapes ne rassure personne.
   */
  const runCycle = async () => {
    setReport(null);
    setSteps(idleSteps());
    setCycling(true);

    try {
      const response = await fetch("/api/cycle", { method: "POST" });
      if (!response.ok || !response.body) {
        toast.error("Le cycle n'a pas pu démarrer.");
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;
        const lines = buffer.split("\n");
        // La dernière portion peut être une ligne coupée en deux paquets.
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) applyEvent(JSON.parse(line) as CycleEvent);
        }
      }

      // Entonnoir, rendement, compteurs : tout a bougé.
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cycle interrompu.");
    } finally {
      setCycling(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Sourcing et entonnoir</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* ---------------------------------------------------------- */}
        {/* Ce qu'on cherche                                            */}
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-3">
          <label className="flex flex-wrap items-center gap-2.5 text-dense">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => changeEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Activer le sourcing automatique quotidien
            <FieldStatus
              status={enabledField.status}
              error={enabledField.error}
              className="ml-1"
            />
          </label>

          <div
            role="group"
            aria-labelledby="requetes-titre"
            className="flex flex-col gap-1.5"
          >
            <span className="flex items-center gap-2">
              <span id="requetes-titre" className="text-dense font-medium leading-none">
                Requêtes
              </span>
              <FieldStatus status={queriesField.status} error={queriesField.error} />
            </span>

            {queries.length > 0 && (
              /* Des étiquettes, pas des lignes de tableau : ce sont trois
                 mots, ils n'ont pas besoin de toute la largeur. Douze
                 requêtes tiennent en trois lignes au lieu de douze, et la
                 place gagnée sert à afficher ce que chacune a ramené. */
              <ul className="flex flex-wrap gap-2">
                {queries.map((query) => {
                  const sourced = yields.find((row) => row.query === query)?.leads;
                  return (
                    <li
                      key={query}
                      className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pl-3 pr-1 text-sm"
                    >
                      <span>{query}</span>
                      {sourced === undefined ? (
                        <span className="text-xs text-muted-foreground">jamais lancée</span>
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {sourced} fiche{sourced > 1 ? "s" : ""}
                        </span>
                      )}
                      <ActionButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 rounded-full p-0 [&_svg]:size-3"
                        aria-label={`Retirer la requête ${query}`}
                        tooltip={`Retirer « ${query} ». Les leads déjà sourcés par cette requête sont conservés.`}
                        onClick={() => commitQueries(queries.filter((q) => q !== query))}
                      >
                        <X size={12} aria-hidden />
                      </ActionButton>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-center gap-2">
              <Input
                aria-label="Nouvelle requête de sourcing"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  // Sans ça, Entrée soumettrait le formulaire des réglages.
                  event.preventDefault();
                  addQuery(draft);
                  setDraft("");
                }}
                placeholder="métier + ville, par exemple « plombier Toulouse »"
              />
              <ActionButton
                type="button"
                variant="outline"
                tooltip="Ajoute cette requête à la liste. Elle sera lancée au prochain cycle."
                onClick={() => {
                  addQuery(draft);
                  setDraft("");
                }}
              >
                <Plus size={16} />
                Ajouter
              </ActionButton>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {queries.length === 0
                ? "Aucune requête : le cycle ne sourcera rien."
                : `Jusqu'à ${
                    queries.length * PLACES_PER_QUERY
                  } fiches par cycle, facturées par Google. Les fiches déjà connues sont mises à jour, pas recréées.`}
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        {/* Ce que ça donne                                             */}
        {/* ---------------------------------------------------------- */}
        {yields.length > 0 && (
          <div className="flex flex-col gap-3 border-t pt-5">
            <div>
              <span className="text-sm font-medium leading-none">Rendement par requête</span>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                La vie d&apos;un lead, étape par étape. C&apos;est entre deux colonnes que ça
                meurt, pas dans le total.
              </p>
            </div>

            {/* Une ligne par requête : au-delà d'une dizaine, la carte
                devient un mur. On plafonne, l'en-tête reste visible. */}
            <div className="max-h-72 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th scope="col" className="px-3 py-2 text-left font-medium">Requête</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Sourcés</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Joignables</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">≥ seuil</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Inscrits</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Score moyen</th>
                  </tr>
                </thead>
                <tbody>
                  {yields.map((row) => (
                    <tr key={row.query} className="border-b last:border-0">
                      <td className="px-3 py-2">{row.query}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.leads}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.reachable}</td>
                      <td
                        className={
                          row.eligible === 0
                            ? "px-3 py-2 text-right font-medium tabular-nums text-destructive"
                            : "px-3 py-2 text-right tabular-nums"
                        }
                      >
                        {row.eligible}
                      </td>
                      <td
                        className={
                          row.enrolled > 0
                            ? "px-3 py-2 text-right font-medium tabular-nums text-success"
                            : "px-3 py-2 text-right tabular-nums text-muted-foreground"
                        }
                      >
                        {row.enrolled}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.avgScore ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="minEnrollScore" className="shrink-0">
                  Score minimum pour inscrire
                </Label>
                <FieldStatus
                  status={thresholdField.status}
                  error={thresholdField.error}
                  className="order-last"
                />
                <Input
                  id="minEnrollScore"
                  type="number"
                  min={0}
                  max={100}
                  value={threshold}
                  onChange={(event) => changeThreshold(Number(event.target.value))}
                  className="h-9 w-20"
                />
              </div>

              {thresholds.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Ce que donnerait chaque seuil sur tes leads actuels — clique pour
                    l&apos;appliquer :
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {thresholds.map((option) => {
                      const total = option.viaEmail + option.viaPhone;
                      const active = option.threshold === threshold;
                      return (
                        <li key={option.threshold}>
                          <button
                            type="button"
                            aria-pressed={active}
                            onClick={() => changeThreshold(option.threshold)}
                            className={
                              active
                                ? "rounded-full bg-ink text-on-ink px-3 py-1.5 text-meta font-medium tabular-nums"
                                : "rounded-full border px-3 py-1.5 text-meta tabular-nums hover:bg-accent"
                            }
                          >
                            <span className="font-medium">seuil {option.threshold}</span> →{" "}
                            {total} inscriptible{total > 1 ? "s" : ""}
                            <span className="text-muted-foreground">
                              {" "}
                              ({option.viaEmail} email · {option.viaPhone} tél.)
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Aucun lead scoré pour l&apos;instant : lance un cycle pour voir l&apos;effet
                  du seuil.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- */}
        {/* Ce qu'on pourrait essayer ensuite                            */}
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-3 border-t pt-5">
          <div>
            <ActionButton
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={propose}
              tooltip="Demande à Claude de nouvelles requêtes de sourcing, à partir de ton offre et du rendement ci-dessus."
              confirm={{
                title: "Demander des propositions ?",
                description:
                  "Claude propose jusqu'à six nouvelles requêtes, en partant de ton offre, de ta liste actuelle et du rendement mesuré de chaque requête. C'est un appel facturé, une dizaine de secondes. Rien n'est ajouté à ta liste ni lancé chez Google : les propositions s'affichent en dessous et tu tries.",
                action: "Demander",
              }}
            >
              <Sparkles size={16} animate={pending || undefined} loop={pending || undefined} />
              {pending ? "Recherche…" : "Proposer des requêtes"}
            </ActionButton>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Ce que tu écartes ne revient jamais — mais reste consultable plus bas.
            </p>
          </div>

          {suggestions.length > 0 && (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg border p-2">
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  className="flex items-start justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{suggestion.query}</p>
                    {suggestion.rationale && (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {suggestion.rationale}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <ActionButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => accept(suggestion)}
                      tooltip="Ajoute cette requête à la liste ci-dessus. Pense à enregistrer ensuite."
                    >
                      <Plus size={16} />
                      Ajouter
                    </ActionButton>
                    <ActionButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      aria-label={`Écarter la requête ${suggestion.query}`}
                      onClick={() => dismiss(suggestion)}
                      tooltip="Écarte cette requête. Le modèle ne la reproposera plus."
                    >
                      <X size={16} aria-hidden />
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {dismissed.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowDismissed((open) => !open)}
                className="text-xs text-muted-foreground underline underline-offset-4"
              >
                {showDismissed ? "Masquer" : "Voir"} les {dismissed.length} requête
                {dismissed.length > 1 ? "s" : ""} écartée{dismissed.length > 1 ? "s" : ""}
              </button>

              {showDismissed && (
                <ul className="mt-2 flex max-h-60 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
                  {dismissed.map((suggestion) => (
                    <li
                      key={suggestion.id}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm text-muted-foreground"
                    >
                      <span>{suggestion.query}</span>
                      <ActionButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        aria-label={`Remettre la requête ${suggestion.query} dans les propositions`}
                        onClick={() => restore(suggestion)}
                        tooltip="Remet cette requête dans les propositions."
                      >
                        <RotateCcw size={16} aria-hidden />
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------- */}
        {/* Lancer                                                      */}
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-2 border-t pt-5">
          <div>
            <ActionButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={runCycle}
              /* Il était verrouillé tant que des réglages n'étaient pas
                 enregistrés — le cycle travaille sur la base, pas sur
                 l'écran. Tout étant écrit au fil de l'eau, les deux ne
                 peuvent plus diverger et le verrou n'a plus d'objet. */
              tooltip="Exécute tout de suite le cycle quotidien, sans attendre 5 h du matin."
              confirm={{
                title: "Lancer le cycle maintenant ?",
                description:
                  "Deux étapes : sourcing Google Places sur tes requêtes, puis inscription en séquence des leads joignables au-dessus du seuil, par email ou par téléphone quand il n'y a pas d'adresse. Seul Google est facturé ici. Aucun message n'est rédigé et rien n'est envoyé : les actions arrivent dans « À faire aujourd'hui » avec leur bouton « Rédiger le message », et c'est toi qui décides quand dépenser un appel.",
                action: "Lancer le cycle",
              }}
            >
              {cycling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play size={16} />}
              {cycling ? "Cycle en cours…" : "Lancer le cycle maintenant"}
            </ActionButton>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Le cron tourne tout seul à 5 h UTC une fois le projet déployé. Ce bouton
            fait la même chose, à la demande. Le sourcing peut prendre une minute ou
            deux.
          </p>

          {steps && (
            <ol className="flex flex-col gap-4 rounded-lg border p-4">
              {STEP_ORDER.map((key) => {
                const step = steps[key];
                const ratio =
                  step.total && step.done !== null ? Math.min(1, step.done / step.total) : null;

                return (
                  <li key={key} className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      {step.status === "running" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                      ) : step.status === "done" ? (
                        <Check size={16} className="text-success" animate aria-hidden />
                      ) : step.status === "error" ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40" aria-hidden />
                      )}
                      <span className="sr-only">{STEP_STATUS_LABEL[step.status]}</span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          step.status === "pending"
                            ? "text-sm font-medium text-muted-foreground"
                            : "text-sm font-medium"
                        }
                      >
                        {STEP_TITLES[key]}
                        {step.status === "running" && step.total !== null && (
                          <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                            {step.done}/{step.total}
                          </span>
                        )}
                      </p>

                      {step.expect && (
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {step.expect}
                        </p>
                      )}

                      {ratio !== null && step.status === "running" && (
                        <div
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={step.total ?? undefined}
                          aria-valuenow={step.done ?? undefined}
                          aria-label={`${STEP_TITLES[key]} : ${step.done} sur ${step.total}`}
                          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted"
                        >
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.round(ratio * 100)}%` }}
                          />
                        </div>
                      )}

                      {step.detail && (
                        <p
                          className={
                            step.status === "error"
                              ? "mt-1 text-xs leading-relaxed text-destructive"
                              : "mt-1 text-xs leading-relaxed"
                          }
                        >
                          {step.detail}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {report && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="tabular-nums">
                <span className="font-medium">{report.sourced}</span> fiche
                {report.sourced > 1 ? "s" : ""} sourcée{report.sourced > 1 ? "s" : ""} ·{" "}
                <span className="font-medium">{report.enrolled}</span> lead
                {report.enrolled > 1 ? "s" : ""} inscrit{report.enrolled > 1 ? "s" : ""}
              </p>
              {report.errors.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-destructive">
                  {report.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
