import type { NextConfig } from "next";

const config: NextConfig = {
  // Le sourcing sonde des sites tiers : ces appels sortent du runtime Node,
  // jamais de l'edge, d'où le runtime nodejs sur les routes concernées.
  serverExternalPackages: ["postgres"],
};

export default config;
