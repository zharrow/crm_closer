"use server";

import { revalidatePath } from "next/cache";
import { db, leads } from "@/db/client";
import { enqueue } from "@/lib/queue";
import { currentUser, isAllowedEmail } from "@/lib/supabase/server";
import { normalizeUrl } from "@/lib/utils";

export interface ImportRow {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  postalCode?: string;
  linkedinUrl?: string;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  error?: string;
}

const MAX_ROWS = 500;

/**
 * Import CSV.
 *
 * L'enrichissement (sonde du site, données légales, recherche d'adresse)
 * n'est pas fait ici : cinquante sondes à cinq secondes dépasseraient la
 * limite de temps d'une fonction. Chaque lead part dans la file, une
 * invocation par lead.
 */
export async function importLeads(rows: ImportRow[]): Promise<ImportResult> {
  const user = await currentUser();
  if (!user || !isAllowedEmail(user.email)) {
    return { inserted: 0, skipped: 0, error: "Non autorisé" };
  }

  const valid = rows
    .filter((row) => row.companyName?.trim())
    .slice(0, MAX_ROWS)
    .map((row) => ({
      source: "csv_import" as const,
      companyName: row.companyName.trim(),
      contactName: row.contactName?.trim() || null,
      email: row.email?.trim().toLowerCase() || null,
      phone: row.phone?.trim() || null,
      website: normalizeUrl(row.website),
      city: row.city?.trim() || null,
      postalCode: row.postalCode?.trim() || null,
      linkedinUrl: row.linkedinUrl?.trim() || null,
    }));

  if (valid.length === 0) {
    return { inserted: 0, skipped: rows.length, error: "Aucune ligne exploitable." };
  }

  const inserted = await db.insert(leads).values(valid).returning({ id: leads.id });

  for (const lead of inserted) {
    await enqueue("enrich-lead", { leadId: lead.id });
  }

  revalidatePath("/", "layout");
  return { inserted: inserted.length, skipped: rows.length - inserted.length };
}
