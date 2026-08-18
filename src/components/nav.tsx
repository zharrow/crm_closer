"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Loader2, Users, Upload, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/action-button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "À faire", icon: CheckSquare },
  { href: "/prospects", label: "Prospects", icon: Users },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/reglages", label: "Réglages", icon: Settings },
];

/**
 * L'icône devient une roue pendant la navigation.
 *
 * Les pages sont en `force-dynamic` : elles interrogent la base à chaque
 * fois, et Next ne peut rien préparer à l'avance faute de fallback. Entre
 * le clic et l'affichage, l'écran restait donc identique — on clique une
 * deuxième fois en croyant avoir raté le lien. Le remplacement se fait à
 * dimensions égales, 16 × 16 dans les deux cas : rien ne bouge autour.
 */
function NavIcon({ icon: Icon }: { icon: typeof CheckSquare }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
  ) : (
    <Icon className="h-4 w-4" aria-hidden />
  );
}

export function Nav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4 sm:px-6">
        <span className="mr-4 hidden text-sm font-semibold tracking-tight sm:block">
          Prospection
        </span>

        <nav aria-label="Navigation principale" className="flex flex-1 items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <NavIcon icon={Icon} />
                {/* Sous `sm` le libellé disparaît à l'œil mais reste dans
                    l'arbre d'accessibilité : un lien qui ne serait qu'une
                    icône n'a plus de nom à annoncer. */}
                <span className="sr-only sm:not-sr-only">{label}</span>
                {href === "/" && pendingCount > 0 && (
                  <span className="ml-0.5 rounded bg-primary px-1.5 py-0.5 text-meta font-semibold tabular-nums text-primary-foreground">
                    {pendingCount}
                    <span className="sr-only">
                      {" "}
                      action{pendingCount > 1 ? "s" : ""} en attente
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <ActionButton
          variant="ghost"
          size="icon"
          onClick={signOut}
          aria-label="Se déconnecter"
          tooltip="Ferme ta session et te renvoie à l'écran de connexion."
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </ActionButton>
      </div>
    </header>
  );
}
