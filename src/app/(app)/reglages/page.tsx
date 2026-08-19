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
import { ThemeToggle } from "@/components/theme-toggle";

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

      {/* Hors du formulaire, volontairement : ce choix vaut pour cet appareil
          et s'applique au clic. Le glisser entre des champs qui attendent
          « Enregistrer » laisserait croire qu'il faut le valider aussi. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Apparence</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ThemeToggle />
          <p className="text-meta leading-relaxed text-muted-foreground">
            S&apos;applique tout de suite, et cet appareil s&apos;en souvient. Ce
            réglage ne part pas en base : ton téléphone et ton ordinateur peuvent
            donc avoir chacun le leur.
          </p>
        </CardContent>
      </Card>

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
            {/* Absente, la rédaction d'un email échoue avant même d'appeler le
                modèle : le lien de désinscription ne peut pas être fabriqué. */}
            <Check
              label="Adresse publique de l'app"
              ok={Boolean(process.env.NEXT_PUBLIC_APP_URL)}
              hint="NEXT_PUBLIC_APP_URL. Sert à fabriquer le lien de désinscription. Sans elle, aucun email ne peut être rédigé — et un brouillon écrit ailleurs garde l'adresse de là-bas."
            />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
