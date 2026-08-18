"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuerySuggestion, Settings } from "@/db/schema";
import type { QueryYield, ThresholdOption } from "@/lib/query-suggestions";
import { saveSettings } from "./actions";
import { SourcingCard } from "./sourcing-card";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SettingsForm({
  settings,
  suggestions,
  dismissed,
  yields,
  thresholds,
}: {
  settings: Settings;
  suggestions: QuerySuggestion[];
  dismissed: QuerySuggestion[];
  yields: QueryYield[];
  thresholds: ThresholdOption[];
}) {
  const [pending, startTransition] = useTransition();
  // Horodatage de la dernière sauvegarde réussie. La carte Sourcing s'en
  // sert pour reprendre l'écran comme référence, plutôt que d'attendre
  // que les props reviennent du serveur.
  const [savedAt, setSavedAt] = useState(0);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveSettings(data);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSavedAt(Date.now());
      toast.success("Réglages enregistrés");
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ton offre</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field
            label="Ce que tu proposes"
            hint="Une ou deux phrases simples. C'est le socle de chaque message rédigé."
          >
            <Textarea
              name="offer"
              rows={3}
              defaultValue={settings.offer}
              placeholder="Je crée des sites et applications sur mesure qui font gagner du temps aux entreprises."
            />
          </Field>

          <Field
            label="Les problèmes que tu résous"
            hint="Concrets et observables. Le modèle relie les signaux détectés à ces problèmes."
          >
            <Textarea
              name="painPoints"
              rows={3}
              defaultValue={settings.painPoints}
              placeholder="Site vieillissant qui ne convertit pas, tâches manuelles chronophages, pas de prise de rendez-vous en ligne."
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ton identité</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" hint="Sert de signature dans les emails.">
            <Input name="senderFirstName" defaultValue={settings.senderFirstName} placeholder="Florent" />
          </Field>

          <Field label="Lien de prise de rendez-vous" hint="Cal.com, Calendly, ou autre.">
            <Input
              name="bookingUrl"
              type="url"
              defaultValue={settings.bookingUrl}
              placeholder="https://cal.com/toi/20min"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Mentions légales d'expéditeur"
              hint="Obligatoires en prospection B2B : identité complète, ajoutée en pied de chaque email."
            >
              <Input
                name="senderIdentity"
                defaultValue={settings.senderIdentity}
                placeholder="Florent — développeur indépendant, Toulouse — SIRET 000 000 000 00000"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rédaction</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Modèle"
            hint="Opus 5 par défaut. Haiku 4.5 divise le coût par cinq, avec des accroches plus plates."
          >
            <select
              name="draftModel"
              defaultValue={settings.draftModel}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="claude-opus-5">Claude Opus 5 — le plus fin</option>
              <option value="claude-sonnet-5">Claude Sonnet 5 — équilibré</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5 — le moins cher</option>
            </select>
          </Field>

          <Field label="Effort" hint="Sans effet sur Haiku, qui ne gère pas ce réglage.">
            <select
              name="draftEffort"
              defaultValue={settings.draftEffort}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="low">Bas — rapide et suffisant</option>
              <option value="medium">Moyen</option>
              <option value="high">Élevé — plus lent, plus cher</option>
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cadence</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Inscriptions / jour" hint="Nouveaux leads mis en séquence chaque matin.">
            <Input name="enrollBatch" type="number" min={0} max={200} defaultValue={settings.enrollBatch} />
          </Field>

          <Field label="Brouillons / jour" hint="Plafond de rédactions automatiques par exécution.">
            <Input name="dailyTaskCap" type="number" min={0} max={200} defaultValue={settings.dailyTaskCap} />
          </Field>
        </CardContent>
      </Card>

      <SourcingCard
        settings={settings}
        initialSuggestions={suggestions}
        initialDismissed={dismissed}
        savedAt={savedAt}
        yields={yields}
        thresholds={thresholds}
      />

      <div>
        <ActionButton
          type="submit"
          disabled={pending}
          tooltip="Enregistre tous les réglages de la page, y compris la liste des requêtes de sourcing."
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </ActionButton>
      </div>
    </form>
  );
}
