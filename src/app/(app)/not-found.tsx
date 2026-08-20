import Link from "next/link";
import { SearchX } from "lucide-react";

/**
 * `notFound()` est levé depuis la fiche prospect quand l'identifiant ne
 * correspond à rien — un lien d'un ancien onglet, ou un prospect supprimé
 * entre-temps. Sans ce fichier, Next livrait sa page par défaut : fond
 * blanc, « This page could not be found », en anglais, sans la barre de
 * navigation. On reste donc dans l'app, en français, avec une sortie.
 */
export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div>
        <h1 className="display text-headline">
          Cette page n&apos;existe pas
        </h1>
        <p className="mx-auto mt-2 max-w-md leading-relaxed text-muted-foreground">
          Le prospect a peut-être été supprimé, ou le lien vient d&apos;un onglet
          resté ouvert depuis un moment.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/prospects"
          className="text-sm font-medium underline underline-offset-4"
        >
          Voir les prospects
        </Link>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          Retour à la file du jour
        </Link>
      </div>
    </div>
  );
}
