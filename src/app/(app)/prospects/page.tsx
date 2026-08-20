import Link from "next/link";
import { ScrollMemory } from "@/components/scroll-memory";
import { and, desc, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, leads } from "@/db/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/score-badge";
import { formatDate } from "@/lib/utils";
import { NewLeadDialog } from "./new-lead-dialog";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/lead-status";
import { StatusFilter } from "./filters";

export const dynamic = "force-dynamic";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string }>;
}) {
  const { statut, q } = await searchParams;

  const filters: SQL[] = [];
  if (statut && statut !== "tous") filters.push(sql`${leads.status} = ${statut}`);
  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    filters.push(
      or(
        ilike(leads.companyName, term),
        ilike(leads.city, term),
        ilike(leads.email, term),
      )!,
    );
  }

  const rows = await db
    .select({
      id: leads.id,
      companyName: leads.companyName,
      contactName: leads.contactName,
      city: leads.city,
      email: leads.email,
      status: leads.status,
      score: leads.score,
      scoreRationale: leads.scoreRationale,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(leads.score), desc(leads.createdAt))
    .limit(200);

  // « Aucun résultat » et « aucun prospect » ne sont pas le même écran, et
  // ne demandent pas le même geste : l'un veut qu'on élargisse la recherche,
  // l'autre qu'on importe. Les confondre, c'est conseiller un import à
  // quelqu'un qui a deux cents leads et une faute de frappe.
  const filtered = Boolean((statut && statut !== "tous") || q?.trim());

  return (
    <div className="flex flex-col gap-6">
      <ScrollMemory />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display text-display">Prospects</h1>
          <p className="mt-3 text-body text-muted-foreground">
            {rows.length} affiché{rows.length > 1 ? "s" : ""}
            {rows.length === 200 && " (200 maximum)"}
          </p>
        </div>
        <NewLeadDialog />
      </div>

      <StatusFilter current={statut ?? "tous"} query={q ?? ""} />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            {filtered ? (
              <>
                <p className="max-w-md leading-relaxed text-muted-foreground">
                  Aucun prospect ne correspond
                  {q?.trim() ? <> à <span className="font-medium text-foreground">« {q.trim()} »</span></> : null}
                  {statut && statut !== "tous" ? (
                    <> avec le statut «&nbsp;{STATUS_LABEL[statut] ?? statut}&nbsp;»</>
                  ) : null}
                  .
                </p>
                <Link href="/prospects" className="font-medium underline underline-offset-4">
                  Effacer les filtres
                </Link>
              </>
            ) : (
              <>
                <p className="max-w-md leading-relaxed text-muted-foreground">
                  Aucun prospect pour l&apos;instant.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link href="/import" className="font-medium underline underline-offset-4">
                    Importer un CSV
                  </Link>
                  <span className="text-muted-foreground">
                    ou ajoute-en un à la main avec «&nbsp;Ajouter&nbsp;».
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-panel bg-card shadow-raised dark:border">
          <table className="w-full text-dense">
            <thead className="border-b bg-muted text-left text-muted-foreground">
              <tr>
                <th scope="col" className="eyebrow px-4 py-3">Entreprise</th>
                <th scope="col" className="eyebrow hidden px-4 py-3 sm:table-cell">Ville</th>
                <th scope="col" className="eyebrow px-4 py-3">Statut</th>
                <th scope="col" className="eyebrow px-4 py-3 text-right">Score</th>
                <th scope="col" className="eyebrow hidden px-4 py-3 text-right md:table-cell">
                  Mise à jour
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/prospects/${lead.id}`}
                      className="font-medium hover:underline underline-offset-4"
                    >
                      {lead.companyName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {lead.contactName ?? lead.email ?? "—"}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {lead.city ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[lead.status] ?? "outline"}>
                      {STATUS_LABEL[lead.status] ?? lead.status}
                    </Badge>
                  </td>
                  <td className="numeric px-4 py-3 text-right">
                    {lead.score === null ? (
                      "—"
                    ) : (
                      <ScoreBadge score={lead.score} rationale={lead.scoreRationale} />
                    )}
                  </td>
                  <td className="numeric hidden px-4 py-3 text-right text-muted-foreground md:table-cell">
                    {formatDate(lead.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
