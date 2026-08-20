import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; next?: string }>;
}) {
  const { erreur, next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="display text-display">Prospection</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Accès réservé. Le compte se crée depuis Supabase, pas ici.
      </p>

      {erreur === "non-autorise" && (
        <p className="mt-6 rounded-2xl bg-tint-clay p-4 text-dense text-foreground">
          Ce compte n&apos;est pas autorisé à accéder à l&apos;outil.
        </p>
      )}

      <LoginForm next={next ?? "/"} />
    </main>
  );
}
