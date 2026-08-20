import Link from "next/link";

/**
 * Le 404 des URL qui ne tombent dans aucun groupe de routes — une adresse
 * tapée de travers, un vieux lien. Il s'affiche hors de la coquille de
 * l'app, donc sans navigation : la seule sortie utile est la racine.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="display text-display">Page introuvable</h1>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Cette adresse ne correspond à rien dans l&apos;outil.
      </p>
      <Link href="/" className="mt-6 text-sm font-medium underline underline-offset-4">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
