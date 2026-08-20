"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, CheckSquare, Loader2 } from "lucide-react";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Users } from "@/components/animate-ui/icons/users";
import { Settings } from "@/components/animate-ui/icons/settings";
import { LogOut } from "@/components/animate-ui/icons/log-out";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/action-button";
import { createClient } from "@/lib/supabase/client";

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
  { href: "/", label: "À faire", icon: CheckSquare, animated: false, counter: "pending" },
  { href: "/prospects", label: "Prospects", icon: Users, animated: true, counter: "leads" },
  { href: "/rythme", label: "Rythme", icon: Activity, animated: false, counter: null },
  { href: "/reglages", label: "Réglages", icon: Settings, animated: true, counter: null },
] as const;

/* L'ordre suit la journée : le travail, le stock, le compte rendu, la
   configuration.

   `/import` n'est pas dans cette liste, et la route existe pourtant : elle
   se rejoint depuis les écrans vides de la file et de la liste, au moment
   où l'on n'a rien à traiter — le seul où l'on importe. Une entrée
   permanente pour un geste qu'on fait deux fois prendrait la place d'une
   destination qu'on ouvre tous les jours.

   `/rythme`, lui, en est une. C'est le seul écran qui réponde à « est-ce que
   je tiens la cadence », et il n'a nulle part d'autre où se rejoindre : sans
   entrée dans le rail il serait écrit et inatteignable. */

type NavLinkSpec = (typeof LINKS)[number];

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
}: {
  icon: NavLinkSpec["icon"];
  animated: boolean;
}) {
  const { pending } = useLinkStatus();

  if (pending) return <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;

  // Les deux familles n'ont pas la même signature : Animate UI prend une
  // taille en nombre, Lucide s'habille en classes utilitaires.
  if (animated) {
    const Animated = Icon as (typeof LINKS)[1]["icon"];
    return (
      /* Pas d'`animateOnHover` ici : le lien entier est le déclencheur,
         posé plus bas. Viser une icône de 16 px pour obtenir une réaction
         est un jeu d'adresse, pas une interface. */
      <Animated size={16} aria-hidden />
    );
  }

  const Static = Icon as typeof CheckSquare;
  return <Static className="h-4 w-4" aria-hidden />;
}

/**
 * Deux compteurs, deux registres.
 *
 * « À faire » compte du travail qui attend : c'est le motif d'ouverture de
 * l'app. Il porte donc une pastille pleine, et elle est **ambre** — le ton
 * de l'attente. Pas zeste : le zeste dit « tu es ici » sur le rail, et deux
 * choses différentes ne peuvent pas partager la même couleur à quinze
 * pixels d'écart. Pas cobalt non plus : un bleu foncé sur un rail encre est
 * un bloc sombre sur du sombre, on ne le voit qu'en le cherchant.
 *
 * « Prospects » compte un stock sur lequel il n'y a rien à faire dans
 * l'instant ; il se rend en nombre nu. Les mettre tous les deux en pastille
 * rendrait la première ordinaire, et c'est précisément celle qu'il faut voir
 * en entrant.
 *
 * Un compteur à zéro ne s'affiche pas : « 0 » et rien disent la même chose,
 * mais « 0 » occupe le coin de l'œil pour le dire.
 */
function NavCount({ value, emphatic }: { value: number; emphatic: boolean }) {
  if (value <= 0) return null;

  if (emphatic) {
    return (
      <span className="numeric ml-auto rounded-full bg-amber px-2 py-0.5 text-meta font-semibold text-on-amber">
        {value}
        <span className="sr-only"> action{value > 1 ? "s" : ""} en attente</span>
      </span>
    );
  }

  return <span className="numeric ml-auto text-meta text-on-ink/70">{value}</span>;
}

/**
 * L'entrée active est une pilule zeste.
 *
 * Elle était rendue en carte soulevée sur un rail clair : deux nuances de
 * beige à 4 % d'écart, invisibles dès qu'on ne fixe pas la barre. Sur un
 * rail encre, un aplat zeste tranche à 13,9:1 — on sait où l'on est sans
 * lire, ce qui est toute la fonction d'une navigation.
 *
 * Le zeste ne dit pas « action » : il dit « présent ». C'est pour ça qu'il
 * peut porter la position sans voler sa couleur au bouton principal, qui
 * reste cobalt partout dans l'app.
 */
function NavLink({
  link,
  active,
  count,
  layout,
}: {
  link: NavLinkSpec;
  active: boolean;
  count: number | null;
  layout: "rail" | "bar";
}) {
  return (
    <AnimateIcon animateOnHover asChild>
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-full font-medium transition-colors",
          layout === "rail" ? "px-4 py-2.5 text-dense" : "px-3.5 py-2 text-meta",
          active
            ? "bg-zest text-on-zest"
            : "text-on-ink/70 hover:bg-on-ink/10 hover:text-on-ink",
        )}
      >
        <NavIcon icon={link.icon} animated={link.animated} />
        {/* Dans la barre étroite le libellé disparaît à l'œil mais reste
            dans l'arbre d'accessibilité : un lien qui ne serait qu'une
            icône n'a plus de nom à annoncer. Dans le rail il est toujours
            écrit — l'app se destine à une vue qui baisse, et une navigation
            réduite à des pictogrammes est exactement ce qu'il ne faut pas
            lui servir. */}
        <span className={layout === "bar" ? "sr-only sm:not-sr-only" : undefined}>
          {link.label}
        </span>
        {count !== null && (
          <NavCount value={count} emphatic={link.counter === "pending"} />
        )}
      </Link>
    </AnimateIcon>
  );
}

/**
 * La marque : un carré zeste, l'initiale en encre.
 *
 * Un mot seul en haut d'un rail sombre ne fait pas un repère — il fait une
 * ligne de texte de plus. Le bloc de couleur, lui, se retient : c'est le
 * seul endroit de l'app où le zeste sert à identifier plutôt qu'à situer,
 * et il est assez isolé pour ne pas prêter à confusion.
 */
function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", compact ? "px-1" : "px-2")}>
      <span
        aria-hidden
        className="display grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zest text-title text-on-zest"
      >
        P
      </span>
      <span className={cn("display text-title text-on-ink", compact && "sr-only sm:not-sr-only")}>
        Prospection
      </span>
    </span>
  );
}

/**
 * Le rail flotte, il ne borde pas.
 *
 * Il était collé au bord gauche avec un filet pour le séparer du contenu :
 * une colonne du même beige que la page, distinguée par un trait d'un
 * pixel. Il est maintenant un panneau encre posé *sur* la nappe, à trois
 * unités des bords — la même géométrie que les cartes, et pour la même
 * raison : ce qui compte est posé sur la lumière, pas découpé dedans.
 *
 * Sept des huit références de `inspiration/` posent leur navigation à la
 * verticale, et pour une raison qui vaut ici : la barre horizontale
 * prélevait 3,5 rem de hauteur sur *chaque* écran, et à 112,5 % de racine
 * la hauteur est la ressource rare.
 *
 * Les deux dispositions sont écrites séparément plutôt que pliées en une
 * seule qui changerait de sens : celle qui n'a pas cours est en
 * `display: none`, donc absente de l'arbre d'accessibilité, et il n'y a
 * jamais deux régions de navigation annoncées en même temps.
 */
export function Nav({
  pendingCount,
  leadCount,
}: {
  pendingCount: number;
  leadCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const countFor = (link: NavLinkSpec, layout: "rail" | "bar") => {
    if (link.counter === "pending") return pendingCount;
    // Le stock de prospects n'apparaît que dans le rail : en barre étroite
    // il se retrouverait collé au libellé, et deux nombres côte à côte sur
    // une seule ligne se lisent comme un seul.
    if (link.counter === "leads" && layout === "rail") return leadCount;
    return null;
  };

  /* Le bouton de déconnexion vit sur un aplat encre : les couleurs de survol
     du variant `ghost` sont celles du thème clair et y feraient un éclair
     blanc. `tailwind-merge` remplace bien `hover:bg-accent` par la valeur
     donnée ici — même utilitaire, même modificateur. */
  const signOutClasses =
    "w-full justify-start gap-2.5 font-medium text-on-ink/70 hover:bg-on-ink/10 hover:text-on-ink";

  return (
    <>
      <aside className="sticky top-0 hidden h-svh shrink-0 p-3 lg:flex lg:w-64 lg:flex-col">
        <div className="on-tone flex h-full flex-col gap-7 rounded-panel bg-ink px-3 py-6 shadow-overlay">
          <Wordmark />

          <nav aria-label="Navigation principale" className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <NavLink
                key={link.href}
                link={link}
                active={isActive(link.href)}
                count={countFor(link, "rail")}
                layout="rail"
              />
            ))}
          </nav>

          <div className="mt-auto border-t border-on-ink/15 pt-3">
            <ActionButton
              variant="ghost"
              onClick={signOut}
              className={signOutClasses}
              tooltip="Ferme ta session et te renvoie à l'écran de connexion."
            >
              <LogOut size={16} aria-hidden />
              Se déconnecter
            </ActionButton>
          </div>
        </div>
      </aside>

      {/* Sous `lg`, la même pilule encre, couchée. Le conteneur est collant,
          la capsule flotte dedans : c'est ce qui laisse voir la nappe passer
          derrière elle au défilement. */}
      <header className="sticky top-0 z-40 px-3 pt-3 lg:hidden">
        <div className="on-tone flex h-14 items-center gap-1 rounded-full bg-ink pl-3 pr-2 shadow-overlay">
          <Wordmark compact />

          <nav aria-label="Navigation principale" className="ml-2 flex flex-1 items-center gap-1">
            {LINKS.map((link) => (
              <NavLink
                key={link.href}
                link={link}
                active={isActive(link.href)}
                count={countFor(link, "bar")}
                layout="bar"
              />
            ))}
          </nav>

          <ActionButton
            variant="ghost"
            size="icon"
            onClick={signOut}
            aria-label="Se déconnecter"
            className="shrink-0 text-on-ink/70 hover:bg-on-ink/10 hover:text-on-ink"
            tooltip="Ferme ta session et te renvoie à l'écran de connexion."
          >
            <LogOut size={16} aria-hidden />
          </ActionButton>
        </div>
      </header>
    </>
  );
}
