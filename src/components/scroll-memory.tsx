"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Retient la position dans une liste, et la rend au retour.
 *
 * Les pages de liste sont en `force-dynamic` : au retour arrière, Next
 * refait la requête, et la restauration de position du navigateur se
 * joue avant que les lignes existent — on atterrit donc en haut. On
 * mémorise nous-mêmes plutôt que de compter sur cet ordonnancement.
 *
 * La clé inclut les paramètres d'URL : changer de filtre ou de recherche
 * donne une autre liste, qui n'a aucune raison d'hériter de la position
 * de la précédente.
 */
export function ScrollMemory() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const key = `scroll:${pathname}${search ? `?${search}` : ""}`;

  useEffect(() => {
    const saved = sessionStorage.getItem(key);
    if (saved) {
      // Deux images d'attente : la première laisse React livrer le DOM,
      // la seconde laisse le navigateur calculer la mise en page. Sans
      // ça, on défile vers une position qui n'existe pas encore.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => window.scrollTo(0, Number(saved))),
      );
    }

    let pending = false;
    const remember = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        sessionStorage.setItem(key, String(window.scrollY));
        pending = false;
      });
    };

    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [key]);

  return null;
}
