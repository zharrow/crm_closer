"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Loader2 } from "lucide-react";
import { Users } from "@/components/animate-ui/icons/users";
import { Upload } from "@/components/animate-ui/icons/upload";
import { Settings } from "@/components/animate-ui/icons/settings";
import { LogOut } from "@/components/animate-ui/icons/log-out";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/action-button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Les icônes d'Animate UI s'animent au survol ; celles de Lucide sont
 * immobiles. Le mélange est assumé : le registre n'a pas d'équivalent pour
 * `CheckSquare`, et une icône figée vaut mieux qu'une icône approximative
 * choisie pour la seule raison qu'elle bouge.
 *
 * Le survol, et pas autre chose : rien ne s'agite tant qu'on ne pointe pas.
 * Sur un outil ouvert toute la journée, une animation qui se déclenche seule
 * finit par fatiguer — et l'app se destine à quelqu'un qu'on veut ménager.
 */
const LINKS = [
  { href: "/", label: "À faire", icon: CheckSquare, animated: false },
  { href: "/prospects", label: "Prospects", icon: Users, animated: true },
  { href: "/import", label: "Import", icon: Upload, animated: true },
  { href: "/reglages", label: "Réglages", icon: Settings, animated: true },
] as const;

/**
 * L'icône devient une roue pendant la navigation.
 *
 * Les pages sont en `force-dynamic` : elles interrogent la base à chaque
 * fois, et Next ne peut rien préparer à l'avance faute de fallback. Entre
 * le clic et l'affichage, l'écran restait donc identique — on clique une
 * deuxième fois en croyant avoir raté le lien. Le remplacement se fait à
 * dimensions égales, 16 × 16 dans les deux cas : rien ne bouge autour.
 */
function NavIcon({
  icon: Icon,
  animated,
  active,
}: {
  icon: (typeof LINKS)[number]["icon"];
  animated: boolean;
  active: boolean;
}) {
  const { pending } = useLinkStatus();

  if (pending) return <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;

  // Les deux familles n'ont pas la même signature : Animate UI prend une
  // taille en nombre, Lucide s'habille en classes utilitaires.
  if (animated) {
    const Animated = Icon as (typeof LINKS)[2]["icon"];
    return (
      <Animated
        size={16}
        animateOnHover
        /* La page courante s'anime aussi au survol : son icône n'est pas
           décorative sous prétexte qu'on y est déjà. */
        aria-hidden
      />
    );
  }

  const Static = Icon as typeof CheckSquare;
  return <Static className="h-4 w-4" aria-hidden />;
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
          {LINKS.map(({ href, label, icon: Icon, animated }) => {
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
                <NavIcon icon={Icon} animated={animated} active={active} />
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
          <LogOut size={16} animateOnHover aria-hidden />
        </ActionButton>
      </div>
    </header>
  );
}
