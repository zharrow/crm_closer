"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { FileUp, Upload } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent } from "@/components/ui/card";
import { importLeads, type ImportRow } from "./actions";

/**
 * Les colonnes sont reconnues par alias, sans accent ni casse : un export
 * de tableur français n'a pas à être renommé avant d'être importé.
 */
const ALIASES: Record<keyof ImportRow, string[]> = {
  companyName: ["entreprise", "societe", "société", "nom", "company", "raison sociale", "name"],
  contactName: ["contact", "dirigeant", "prenom nom", "prénom nom", "interlocuteur", "contact name"],
  email: ["email", "e-mail", "mail", "courriel"],
  phone: ["telephone", "téléphone", "tel", "tél", "phone", "portable"],
  website: ["site", "site web", "website", "url", "web"],
  city: ["ville", "city", "commune"],
  postalCode: ["code postal", "cp", "postal", "zip"],
  linkedinUrl: ["linkedin", "linkedin url", "profil linkedin"],
};

function normalize(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mapRow(raw: Record<string, string>): ImportRow {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(raw)) {
    normalized.set(normalize(key), (value ?? "").trim());
  }

  const pick = (field: keyof ImportRow): string | undefined => {
    for (const alias of ALIASES[field]) {
      const value = normalized.get(normalize(alias));
      if (value) return value;
    }
    return undefined;
  };

  return {
    companyName: pick("companyName") ?? "",
    contactName: pick("contactName"),
    email: pick("email"),
    phone: pick("phone"),
    website: pick("website"),
    city: pick("city"),
    postalCode: pick("postalCode"),
    linkedinUrl: pick("linkedinUrl"),
  };
}

export function ImportForm() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const mapped = result.data.map(mapRow).filter((row) => row.companyName);
        if (mapped.length === 0) {
          toast.error("Aucune ligne exploitable — vérifie la colonne du nom d'entreprise.");
          return;
        }
        setRows(mapped);
        setFileName(file.name);
      },
      error: () => toast.error("Fichier illisible."),
    });
  };

  const submit = () =>
    startTransition(async () => {
      const result = await importLeads(rows);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.inserted} prospects importés`);
      setRows([]);
      setFileName(null);
      router.push("/prospects");
    });

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = "";
        }}
      />

      <Card
        className="cursor-pointer border-dashed transition-colors hover:border-foreground/30"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <FileUp className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {fileName ?? "Dépose un fichier CSV, ou clique pour le choisir"}
          </p>
          <p className="text-xs text-muted-foreground">500 lignes maximum par import</p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Entreprise</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Site</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{row.companyName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.contactName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.email ?? "—"}</td>
                    <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                      {row.website ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <ActionButton
              onClick={submit}
              disabled={pending}
              tooltip="Crée les prospects du fichier. Les doublons et les lignes sans nom d'entreprise sont ignorés."
            >
              <Upload className="h-4 w-4" />
              {pending ? "Import…" : `Importer ${rows.length} prospects`}
            </ActionButton>
            <ActionButton
              variant="ghost"
              onClick={() => setRows([])}
              disabled={pending}
              tooltip="Abandonne ce fichier. Rien n'a encore été écrit en base."
            >
              Annuler
            </ActionButton>
            {rows.length > 8 && (
              <span className="text-sm text-muted-foreground">
                Aperçu des 8 premières lignes.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
