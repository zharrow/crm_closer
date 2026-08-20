import { AlertTriangle, Check } from "lucide-react";
import { getSettings } from "@/lib/settings";
import {
  dismissedSuggestions,
  pendingSuggestions,
  queryYield,
  thresholdSimulation,
} from "@/lib/query-suggestions";
import { queueEnabled } from "@/lib/queue";
import { pappersEnabled } from "@/lib/pappers";
import { SettingsGrid } from "./settings-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Réglages" };

/**
 * Les services, en données plutôt qu'en JSX.
 *
 * Ils étaient écrits six fois à la main dans le rendu. Impossible d'en
 * compter les manquants sans les relire un par un — donc la page ne disait
 * nulle part combien il en restait à brancher, alors que c'est la seule
 * question qu'on se pose en ouvrant cet écran.
 *
 * La lecture des variables d'environnement reste dans la fonction : ce
 * fichier est un composant serveur, mais un tableau au niveau du module
 * serait figé au premier chargement.
 */
function services() {
  return [
    {
      label: "Clé Anthropic",
      ok: Boolean(process.env.ANTHROPIC_API_KEY),
      hint: "Sans elle, aucune rédaction n'est possible.",
    },
    {
      label: "QStash",
      ok: queueEnabled(),
      hint: "Sans lui, l'enrichissement s'exécute en ligne — plus lent, et limité à 60 s par import.",
    },
    {
      label: "Google Places",
      ok: Boolean(process.env.GOOGLE_PLACES_API_KEY),
      hint: "Sourcing automatique de commerces. Sans clé, il reste l'import CSV.",
    },
    {
      label: "Pappers",
      ok: pappersEnabled(),
      hint: "Enrichissement SIREN, effectif, dirigeant. Optionnel.",
    },
    {
      label: "Secret de désinscription",
      ok: Boolean(process.env.UNSUBSCRIBE_SECRET),
      hint: "Signe les liens d'opposition. Obligatoire pour l'envoi d'emails.",
    },
    /* Absente, la rédaction d'un email échoue avant même d'appeler le
       modèle : le lien de désinscription ne peut pas être fabriqué. */
    {
      label: "Adresse publique de l'app",
      ok: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      hint: "NEXT_PUBLIC_APP_URL. Sert à fabriquer le lien de désinscription. Sans elle, aucun email ne peut être rédigé — et un brouillon écrit ailleurs garde l'adresse de là-bas.",
    },
  ];
}

/**
 * L'état du montage, au bout de la ligne de titre.
 *
 * Même dispositif que le bandeau de chiffres de la file du jour, et pour la
 * même raison : c'est le résumé de la page, il se lit avant le détail, et
 * posé à droite du titre il ne coûte pas un pixel de hauteur.
 *
 * La pastille change de ton mais **le nombre reste le même** : on ne cache
 * pas un manque derrière une couleur, on le nomme deux fois.
 */
function SetupState({ configured, total }: { configured: number; total: number }) {
  const complete = configured === total;

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
          complete ? "bg-zest text-on-zest" : "bg-amber text-on-amber",
        )}
      >
        {complete ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      </span>
      <span className="flex flex-col leading-none">
        <span className="stat text-stat">
          {configured}/{total}
        </span>
        <span className="mt-1.5 text-meta text-muted-foreground">services connectés</span>
      </span>
    </div>
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

  const checks = services();
  const configured = checks.filter((service) => service.ok).length;

  return (
    /* ---- Le conteneur de référence ----------------------------------
       La grille se réglait sur `lg:`, c'est-à-dire sur la largeur de la
       *fenêtre*. Or le rail prélève 288 px sur cette fenêtre : à 1024 px —
       le seuil de `lg` — la colonne de contenu ne fait plus que 700 px, et
       entre 1024 et 1200 elle *rétrécit* au moment exact où le rail
       apparaît. La grille se décidait donc sur une mesure qui n'était pas
       la sienne, et elle tombait en pile pour la moitié des tailles
       d'écran.

       `@container` la fait réagir à la largeur de la colonne. Les seuils
       sont en pixels et non en `rem` : ils décrivent la place qu'il faut
       pour qu'une cellule reste lisible, pas une taille de texte. */
    <div className="@container flex flex-col gap-8">
      {/* Titre à gauche, état du montage à droite — la ligne de tête de la
          file du jour, reprise telle quelle. Deux écrans qui s'ouvrent de la
          même façon se reconnaissent comme appartenant à la même app. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <h1 className="display text-display">Réglages</h1>
          <p className="mt-3 max-w-xl text-body text-muted-foreground">
            Ce que le modèle sait de toi et de ton offre. Il rédige à partir
            d&apos;ici.
          </p>
        </div>
        <SetupState configured={configured} total={checks.length} />
      </div>

      <SettingsGrid
        settings={settings}
        suggestions={suggestions}
        dismissed={dismissed}
        yields={yields}
        thresholds={thresholds}
      />

      {/* Rien ici ne s'écrit en base : les services se branchent dans
          l'environnement, le thème s'applique au clic et vit dans le
          navigateur. Ils viennent donc après les réglages, pas au milieu. */}
      {/* Cette paire s'accorde plus tôt que la grille du formulaire :
          « Apparence » tient en trois pilules, elle n'a pas besoin de 400 px.
          À 640 px de colonne, les deux tiennent déjà côte à côte.

          `items-start` : la liste des services fait six lignes, « Apparence »
          trois pilules et une phrase. Étirée à la hauteur de sa voisine, la
          petite carte se terminait par un grand vide. Chacune garde donc sa
          hauteur — un bas irrégulier se lit comme une intention, un vide
          comme un oubli. */}
      <div className="grid gap-5 @min-[640px]:grid-cols-12 @min-[640px]:items-start">
        <Card className="flex flex-col @min-[640px]:col-span-8">
          <CardHeader className="pb-4">
            <CardTitle>Services connectés</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Une liste séparée par des filets, pas six petites cartes : ce
                sont des lignes d'un même relevé, et elles se comparent du
                regard de haut en bas. */}
            <ul className="divide-y">
              {checks.map((service) => (
                <li
                  key={service.label}
                  className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-dense font-medium">{service.label}</p>
                    <p className="mt-0.5 text-meta leading-relaxed text-muted-foreground">
                      {service.hint}
                    </p>
                  </div>
                  <Badge variant={service.ok ? "success" : "secondary"}>
                    {service.ok ? "Configuré" : "Absent"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="flex flex-col @min-[640px]:col-span-4">
          <CardHeader className="pb-4">
            <CardTitle>Apparence</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ThemeToggle />
            <p className="text-meta leading-relaxed text-muted-foreground">
              S&apos;applique tout de suite, et cet appareil s&apos;en souvient.
              Ce réglage ne part pas en base : ton téléphone et ton ordinateur
              peuvent donc avoir chacun le leur.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
