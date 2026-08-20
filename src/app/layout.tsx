import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeSync } from "@/components/theme-toggle";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

/**
 * Les caractères, décidés une fois.
 *
 * Sans famille déclarée l'app prenait ce que le système proposait : pas la
 * même chose sur un Mac, un PC et un Android, et jamais choisi. Inter Tight
 * tient le texte dense en 13-15 px, et surtout porte de vrais chiffres
 * tabulaires — un score qui passe de 9 à 10 ne doit pas décaler sa colonne.
 * `next/font` télécharge les fichiers au build et les sert depuis le même
 * domaine : rien ne part chez Google au chargement d'une page.
 */
const sans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/**
 * Le caractère d'affichage, et lui seul.
 *
 * Inter Tight lit très bien à 15 px et très mal à 45 : une grotesque
 * dessinée pour le texte, agrandie, donne un titre mou — les contreformes
 * restent ouvertes, l'approche reste celle du petit corps, et le titre a
 * l'air d'un paragraphe qu'on aurait zoomé. Bricolage Grotesque est
 * dessinée dans l'autre sens : elle a du caractère en grand et n'en a
 * aucun en petit, ce qui est exactement le partage qu'on veut.
 *
 * D'où la règle : elle ne descend jamais sous 20 px. En dessous, c'est
 * Inter Tight — voir l'utilitaire `display` dans `globals.css`.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prospection",
  description: "Sourcing, séquences et file de travail commerciale",
};

/**
 * `colorScheme` annonce les deux thèmes au navigateur : sans lui, les
 * contrôles natifs (le sélecteur de date des rendez-vous, les barres de
 * défilement, l'autofill) restent dessinés en clair sur une interface
 * sombre. Le thème lui-même se décide en CSS, sur la préférence système.
 */
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDEDE6" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0F0E" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* `suppressHydrationWarning` : le script ci-dessous ajoute une classe à
       <html> avant que React n'hydrate. Sans ça, React verrait l'écart entre
       ce qu'il a rendu et ce qu'il trouve, le signalerait comme une erreur,
       et re-rendrait — en effaçant la classe au passage. */
    <html lang="fr" className={`${sans.variable} ${mono.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        {/* Avant toute peinture : sinon on verrait le thème du système
            s'afficher une fraction de seconde, puis être corrigé. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen text-foreground antialiased">
        <ThemeSync />
        {/* Le fournisseur couvre toute l'app, y compris la page de
            connexion et la page d'erreur : sans lui, une infobulle lève. */}
        <TooltipProvider delayDuration={200} skipDelayDuration={300}>
          {children}
        </TooltipProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
