"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Users, Upload, Settings, LogOut } from "lucide-react";
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

        <nav className="flex flex-1 items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                {href === "/" && pendingCount > 0 && (
                  <span className="ml-0.5 rounded bg-primary px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
                    {pendingCount}
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
          tooltip="Ferme ta session et te renvoie à l'écran de connexion."
        >
          <LogOut className="h-4 w-4" />
        </ActionButton>
      </div>
    </header>
  );
}
