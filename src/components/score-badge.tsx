"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { scoreTone } from "@/lib/utils";

/**
 * Le score, avec le motif derrière.
 *
 * La liste allait chercher `scoreRationale` en base pour deux cents lignes
 * et ne l'affichait nulle part : le « pourquoi » du chiffre était payé puis
 * jeté. Le mettre en colonne rendrait le tableau illisible ; l'infobulle le
 * garde à un survol, comme partout ailleurs dans l'app. Un nombre entre 0 et
 * 100 sans son motif n'est pas une information, c'est une note.
 */
export function ScoreBadge({
  score,
  rationale,
}: {
  score: number;
  rationale: string | null;
}) {
  /* `numeric` sur le badge lui-même et non sur la cellule qui l'accueille :
     le même score s'affiche dans le tableau, dans la carte d'action et dans
     l'en-tête de la fiche. Posé au point d'usage, il manquait deux fois
     sur trois. */
  const badge = (
    <Badge variant={scoreTone(score)} className="numeric">
      {score}
    </Badge>
  );

  if (!rationale) return badge;

  return (
    <Tooltip>
      {/* `span` intercalé : `Badge` est un div sans `ref`, Radix ne peut pas
          s'y accrocher directement. */}
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help">{badge}</span>
      </TooltipTrigger>
      <TooltipContent>{rationale}</TooltipContent>
    </Tooltip>
  );
}
