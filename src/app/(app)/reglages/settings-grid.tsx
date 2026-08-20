"use client";

import { cloneElement, useId } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { InlineText } from "./inline-text";
import { InlineInput, InlineSelect } from "./inline-field";
import type { QuerySuggestion, Settings } from "@/db/schema";
import type { QueryYield, ThresholdOption } from "@/lib/query-suggestions";
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
      {/* `-ml-3` : au repos, la valeur est du texte posé dans une zone qui
          ne s'allume qu'au survol. Sans ce décalage, le libellé et sa valeur
          ne seraient pas sur la même verticale — l'un aligné sur la carte,
          l'autre décalé de la marge interne de sa zone cliquable. */}
      <Label htmlFor={id}>{label}</Label>
      <div className="-ml-3">
        {cloneElement(children, { id, "aria-describedby": hintId })}
      </div>
      {hint && (
        <p id={hintId} className="text-meta leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

const MODEL_OPTIONS = [
  { value: "claude-opus-5", label: "Claude Opus 5 — le plus fin" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5 — équilibré" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 — le moins cher" },
];

const EFFORT_OPTIONS = [
  { value: "low", label: "Bas — rapide et suffisant" },
  { value: "medium", label: "Moyen" },
  { value: "high", label: "Élevé — plus lent, plus cher" },
];

/**
 * Les réglages, en grille bento — et sans bouton « Enregistrer ».
 *
 * ---- Pourquoi il n'y a plus de formulaire ----------------------------
 *
 * La page était un `<form>` avec un bouton en bas. Sur un écran de
 * plusieurs hauteurs, ça produit deux défauts qu'on ne voit qu'à l'usage :
 * on corrige un prénom tout en haut, on ne redescend pas, on part — rien
 * n'est écrit ; ou bien on clique et on ne sait pas *ce qui* vient d'être
 * enregistré, puisqu'un bouton unique parle pour douze champs.
 *
 * Chaque champ s'enregistre donc seul, au moment où on le quitte. Ce n'est
 * pas gratuit : en supprimant le bouton on supprime aussi le moment « je
 * valide », donc chaque champ doit dire lui-même ce qui lui arrive. C'est
 * le rôle de `FieldStatus`, et il n'est pas optionnel.
 *
 * ---- Pourquoi les champs ne ressemblent plus à des champs -------------
 *
 * Une page de réglages hérissée de contrôles bordés en permanence *demande*
 * qu'on écrive dedans, alors qu'on vient presque toujours relire. Au repos,
 * une valeur se lit maintenant comme du texte ; le fond et le crayon
 * n'apparaissent qu'au survol. La page se lit comme un document, et
 * s'édite là où on la lit.
 *
 * ---- La grille --------------------------------------------------------
 *
 * En bento, la taille de la cellule *est* la hiérarchie : l'offre occupe
 * sept colonnes sur douze, l'identité les cinq restantes, la rédaction
 * toute la largeur en dessous.
 *
 * Les seuils sont des *requêtes de conteneur* et non des points de rupture
 * d'écran : la grille réagit à la largeur de la colonne de contenu, pas à
 * celle de la fenêtre. Le rail prélève 288 px, donc les deux ne disent pas
 * la même chose — et c'est la colonne qui décide si une cellule a la place
 * d'exister.
 *
 * Le seuil de 680 px est calculé, pas choisi à l'œil : à 1024 px de fenêtre,
 * là où le rail apparaît, il reste 691 px de colonne. Tout seuil au-delà
 * créerait une zone morte où *élargir* sa fenêtre casse la mise en page.
 */
export function SettingsGrid({
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
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 @min-[680px]:grid-cols-12">
        {/* La grande cellule : trois champs longs, sept colonnes sur douze. */}
        <Card className="flex h-full flex-col @min-[680px]:col-span-7">
          <CardHeader className="pb-4">
            <CardTitle>Ton offre</CardTitle>
            <CardDescription>
              Ce que le modèle sait de toi. Ces trois champs partent tels quels
              dans chaque message.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-5">
            <Field
              label="Ce que tu proposes"
              hint="Ce que le client obtient, pas ta méthode. « Sur-mesure » et « cahier des charges » décrivent ta façon de travailler ; « il ne décroche plus pour caler un rendez-vous » décrit ce qu'il gagne. Ce champ part tel quel dans chaque message : c'est tout ce que le modèle sait de toi."
            >
              <InlineText
                name="offer"
                label="Ce que tu proposes"
                defaultValue={settings.offer}
                placeholder="Ex. : je refais les sites des cabinets pour qu'ils remplissent leur agenda en ligne au lieu de décrocher toute la journée — et qu'ils aient l'air aussi sérieux en ligne qu'en cabinet."
              />
            </Field>

            <Field
              label="Les problèmes que tu résous"
              hint="Observables de l'extérieur, sinon ils ne servent à rien : la sonde détecte des constats sur le site, ce champ leur donne un sens. Pense aussi au design et à l'usage, pas seulement à la technique."
            >
              <InlineText
                name="painPoints"
                label="Les problèmes que tu résous"
                defaultValue={settings.painPoints}
                placeholder="Ex. : un site qui fait daté à côté des concurrents, des demandes qui se perdent faute de formulaire, une prise de rendez-vous encore au téléphone, des pages illisibles sur mobile."
              />
            </Field>

            <Field
              label="Tes réalisations comparables"
              hint="Une ou deux, du même monde que tes prospects — une promesse se conteste, une réalisation se vérifie. Dis ce que le client a obtenu, pas la technologie employée. Évite les chiffres : un montant ou un délai chiffré fait recaler le brouillon par les garde-fous."
            >
              <InlineText
                name="proofPoints"
                label="Tes réalisations comparables"
                defaultValue={settings.proofPoints}
                placeholder="Ex. : pour un artisan verrier, un site vitrine où ses réalisations se voient enfin et où les demandes arrivent par formulaire au lieu du téléphone."
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col @min-[680px]:col-span-5">
          <CardHeader className="pb-4">
            <CardTitle>Ton identité</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Field label="Prénom" hint="Sert de signature dans les emails.">
              <InlineInput
                name="senderFirstName"
                label="Prénom"
                defaultValue={settings.senderFirstName}
                placeholder="Florent"
              />
            </Field>

            <Field label="Lien de prise de rendez-vous" hint="Cal.com, Calendly, ou autre.">
              <InlineInput
                name="bookingUrl"
                label="Lien de prise de rendez-vous"
                type="url"
                defaultValue={settings.bookingUrl}
                placeholder="https://cal.com/toi/20min"
              />
            </Field>

            <Field
              label="Mentions légales d'expéditeur"
              hint="Obligatoires en prospection B2B : identité complète, ajoutée en pied de chaque email."
            >
              <InlineInput
                name="senderIdentity"
                label="Mentions légales d'expéditeur"
                defaultValue={settings.senderIdentity}
                placeholder="Florent — développeur indépendant, Toulouse — SIRET 000 000 000 00000"
              />
            </Field>
          </CardContent>
        </Card>

        {/* « Cadence » occupait une carte entière, un en-tête et six rems de
            marge pour *un* champ numérique. Elle rejoint la rédaction : les
            deux règlent le même geste — comment et à quel rythme les
            messages sortent.

            Le seuil des trois colonnes (780 px) est plus haut que celui de
            la grille qui la contient (680) : un `select` doit afficher
            « Claude Opus 5 — le plus fin » en entier, ce qui demande 240 px.
            En dessous, les contrôles s'empilent en pleine largeur. */}
        <Card className="flex h-full flex-col @min-[680px]:col-span-12">
          <CardHeader className="pb-4">
            <CardTitle>Rédaction et cadence</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 @min-[780px]:grid-cols-3">
            <Field
              label="Modèle"
              hint="Opus 5 par défaut. Haiku 4.5 divise le coût par cinq, avec des accroches plus plates."
            >
              <InlineSelect
                name="draftModel"
                defaultValue={settings.draftModel}
                options={MODEL_OPTIONS}
              />
            </Field>

            <Field label="Effort" hint="Sans effet sur Haiku, qui ne gère pas ce réglage.">
              <InlineSelect
                name="draftEffort"
                defaultValue={settings.draftEffort}
                options={EFFORT_OPTIONS}
              />
            </Field>

            <Field label="Inscriptions / jour" hint="Nouveaux leads mis en séquence chaque matin.">
              <InlineInput
                name="enrollBatch"
                label="Inscriptions par jour"
                type="number"
                defaultValue={String(settings.enrollBatch)}
                placeholder="20"
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Le sourcing garde la pleine largeur : ce n'est pas un groupe de
          champs mais un écran dans l'écran — suggestions à accepter, seuil à
          simuler, rendement par requête. Le comprimer à cinq colonnes le
          rendrait illisible pour gagner une symétrie dont personne n'a
          besoin. */}
      <SourcingCard
        settings={settings}
        initialSuggestions={suggestions}
        initialDismissed={dismissed}
        yields={yields}
        thresholds={thresholds}
      />
    </div>
  );
}
