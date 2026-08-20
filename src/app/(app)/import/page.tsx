import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import CSV" };

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="display text-display">Import CSV</h1>
        <p className="mt-1.5 text-muted-foreground">
          Une ligne par entreprise. Seule la colonne du nom est obligatoire.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Colonnes reconnues</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <p>
            L&apos;en-tête est détecté automatiquement, sans tenir compte des accents ni de la
            casse :
          </p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            <li>
              <code className="rounded bg-muted px-1">entreprise</code>, société, nom, company
            </li>
            <li>
              <code className="rounded bg-muted px-1">contact</code>, prénom nom, dirigeant
            </li>
            <li>
              <code className="rounded bg-muted px-1">email</code>, mail, courriel
            </li>
            <li>
              <code className="rounded bg-muted px-1">telephone</code>, tel, phone
            </li>
            <li>
              <code className="rounded bg-muted px-1">site</code>, website, url
            </li>
            <li>
              <code className="rounded bg-muted px-1">ville</code>, city
            </li>
            <li>
              <code className="rounded bg-muted px-1">code postal</code>, cp
            </li>
            <li>
              <code className="rounded bg-muted px-1">linkedin</code>
            </li>
          </ul>
          <p className="mt-3">
            Chaque lead importé part ensuite en enrichissement : sonde du site, données légales,
            recherche d&apos;adresse de contact.
          </p>
        </CardContent>
      </Card>

      <ImportForm />
    </div>
  );
}
