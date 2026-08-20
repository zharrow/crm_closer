import type { NextConfig } from "next";

const config: NextConfig = {
  // Le sourcing sonde des sites tiers : ces appels sortent du runtime Node,
  // jamais de l'edge, d'où le runtime nodejs sur les routes concernées.
  serverExternalPackages: ["postgres"],

  experimental: {
    /**
     * Le cache client, rallumé.
     *
     * Depuis Next 15 la durée de vie des segments dynamiques est à 0 : rien
     * n'est réutilisé. Toutes les pages de l'app étant en `force-dynamic`,
     * chaque aller-retour — la file du jour, une fiche prospect, retour à la
     * file — repartait pour un tour complet côté serveur : proxy, rendu,
     * Postgres. Le préchargement des liens ne servait à rien non plus, sa
     * charge expirant à la seconde où elle arrivait.
     *
     * Trente secondes (le défaut d'avant Next 15) rendent ce va-et-vient
     * instantané. Ce qui *change* n'attend pas pour autant : chaque action
     * serveur appelle `revalidatePath("/", "layout")`, qui vide ce cache —
     * marquer une action envoyée, importer un CSV ou modifier les réglages
     * se voit tout de suite. Le seul décalage possible vient des travaux de
     * fond (enrichissement QStash), qui peuvent mettre une demi-minute à
     * apparaître dans une liste déjà visitée.
     */
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default config;
