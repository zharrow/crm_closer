"use client";

import { cloneElement, useId, useState, useTransition } from "react";
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

/**
 * Un champ : libellé, contrôle, explication.
 *
 * Le libellé était posé à côté du contrôle sans rien qui les relie —
 * visuellement ça se lit, mais cliquer dessus ne donnait pas le focus, et
 * un lecteur d'écran annonçait un champ sans nom. L'identifiant est donc
 * fabriqué ici et injecté dans l'enfant, plutôt que d'être écrit à la main
 * vingt fois. L'explication devient un `aria-describedby` : elle est lue
 * *après* le nom du champ, au lieu de s'y fondre comme le ferait un
 * libellé enveloppant.
 */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string }>;
}) {
  const id = useId();
  const hintId = hint ? `${id}-aide` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id, "aria-describedby": hintId })}
      {hint && (
        <p id={hintId} className="text-meta leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
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
            hint="Ce que le client obtient, pas ta méthode. « Sur-mesure » et « cahier des charges » décrivent ta façon de travailler ; « il ne décroche plus pour caler un rendez-vous » décrit ce qu'il gagne. Ce champ part tel quel dans chaque message : c'est tout ce que le modèle sait de toi."
          >
            <Textarea
              name="offer"
              rows={3}
              defaultValue={settings.offer}
              placeholder="Ex. : je refais les sites des cabinets pour qu'ils remplissent leur agenda en ligne au lieu de décrocher toute la journée — et qu'ils aient l'air aussi sérieux en ligne qu'en cabinet."
            />
          </Field>

          <Field
            label="Les problèmes que tu résous"
            hint="Observables de l'extérieur, sinon ils ne servent à rien : la sonde détecte des constats sur le site, ce champ leur donne un sens. Pense aussi au design et à l'usage, pas seulement à la technique."
          >
            <Textarea
              name="painPoints"
              rows={3}
              defaultValue={settings.painPoints}
              placeholder="Ex. : un site qui fait daté à côté des concurrents, des demandes qui se perdent faute de formulaire, une prise de rendez-vous encore au téléphone, des pages illisibles sur mobile."
            />
          </Field>

          <Field
            label="Tes réalisations comparables"
            hint="Une ou deux, du même monde que tes prospects — une promesse se conteste, une réalisation se vérifie. Dis ce que le client a obtenu, pas la technologie employée. Évite les chiffres : un montant ou un délai chiffré fait recaler le brouillon par les garde-fous."
          >
            <Textarea
              name="proofPoints"
              rows={3}
              defaultValue={settings.proofPoints}
              placeholder="Ex. : pour un artisan verrier, un site vitrine où ses réalisations se voient enfin et où les demandes arrivent par formulaire au lieu du téléphone."
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
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
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
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
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
