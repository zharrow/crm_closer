import Link from "next/link";
import { and, desc, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, leads } from "@/db/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { NewLeadDialog } from "./new-lead-dialog";
import { StatusFilter, STATUS_LABEL, STATUS_VARIANT } from "./filters";

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospects</h1>
          <p className="mt-1.5 text-muted-foreground">
            {rows.length} affiché{rows.length > 1 ? "s" : ""}
            {rows.length === 200 && " (200 maximum)"}
          </p>
        </div>
        <NewLeadDialog />
      </div>

      <StatusFilter current={statut ?? "tous"} query={q ?? ""} />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Aucun prospect. Importe un CSV ou ajoute-en un à la main.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Entreprise</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Ville</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Score</th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">
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
                  <td className="px-4 py-3 text-right tabular-nums">{lead.score ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-right text-muted-foreground md:table-cell">
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
