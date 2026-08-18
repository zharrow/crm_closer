import { getSettings } from "@/lib/settings";
import {
  dismissedSuggestions,
  pendingSuggestions,
  queryYield,
  thresholdSimulation,
} from "@/lib/query-suggestions";
import { queueEnabled } from "@/lib/queue";
import { pappersEnabled } from "@/lib/pappers";
import { SettingsForm } from "./settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Réglages" };

function Check({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <li className="flex items-start justify-between gap-4 border-b py-2.5 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Badge variant={ok ? "success" : "outline"}>{ok ? "Configuré" : "Absent"}</Badge>
    </li>
  );
}

export default async function SettingsPage() {
  // Le seuil conditionne l'entonnoir : les réglages d'abord, le reste
  // ensuite, sinon la colonne « au-dessus du seuil » ne veut rien dire.
  const settings = await getSettings();
  const [suggestions, dismissed, yields, thresholds] = await Promise.all([
    pendingSuggestions(),
    dismissedSuggestions(),
    queryYield(settings.minEnrollScore),
    thresholdSimulation(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>
        <p className="mt-1.5 text-muted-foreground">
          Ce que le modèle sait de toi et de ton offre. Il rédige à partir d&apos;ici.
        </p>
      </div>

      <SettingsForm
        settings={settings}
        suggestions={suggestions}
        dismissed={dismissed}
        yields={yields}
        thresholds={thresholds}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Services connectés</CardTitle>
        </CardHeader>
        <CardContent>
          <ul>
            <Check
              label="Clé Anthropic"
              ok={Boolean(process.env.ANTHROPIC_API_KEY)}
              hint="Sans elle, aucune rédaction n'est possible."
            />
            <Check
              label="QStash"
              ok={queueEnabled()}
              hint="Sans lui, l'enrichissement s'exécute en ligne — plus lent, et limité à 60 s par import."
            />
            <Check
              label="Google Places"
              ok={Boolean(process.env.GOOGLE_PLACES_API_KEY)}
              hint="Sourcing automatique de commerces. Sans clé, il reste l'import CSV."
            />
            <Check
              label="Pappers"
              ok={pappersEnabled()}
              hint="Enrichissement SIREN, effectif, dirigeant. Optionnel."
            />
            <Check
              label="Secret de désinscription"
              ok={Boolean(process.env.UNSUBSCRIBE_SECRET)}
              hint="Signe les liens d'opposition. Obligatoire pour l'envoi d'emails."
            />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
