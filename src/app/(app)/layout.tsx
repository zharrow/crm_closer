import { and, count, eq, lte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, tasks } from "@/db/client";
import { currentUser, isAllowedEmail } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  // Deuxième barrière après le middleware : une session valide ne suffit
  // pas, il faut aussi être sur la liste des comptes autorisés.
  if (!isAllowedEmail(user.email)) redirect("/login?erreur=non-autorise");

  const [pending] = await db
    .select({ n: count() })
    .from(tasks)
    .where(and(eq(tasks.status, "drafted"), lte(tasks.dueAt, new Date())));

  return (
    <>
      <Nav pendingCount={pending?.n ?? 0} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </>
  );
}
