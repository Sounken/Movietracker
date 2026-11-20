"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleWatchlist } from "@/app/actions/film";
import { toggleSeriesWatchlist } from "@/app/actions/series";

/**
 * Logique commune aux trois maquettes d'accueil. Chacune garde son propre
 * balisage : seuls l'état et les appels réseau sont partagés.
 */

/**
 * Carrousel à avance automatique. La progression n'est pas suivie en état :
 * chaque design anime sa barre en CSS sur `duration`, relancée par une `key`
 * sur `idx` — aucun rendu toutes les 60 ms comme dans `HeroCarousel`.
 */
export function useCarousel(n: number, duration = 7000) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (n < 2 || paused) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % n), duration);
    return () => clearTimeout(t);
  }, [idx, n, paused, duration]);

  const go = useCallback((d: number) => setIdx((i) => (i + d + n) % n), [n]);

  return { idx, setIdx, go, paused, setPaused };
}

export type HomeKind = "film" | "series";

/** Watchlist optimiste, comme dans `HeroCarousel`. */
export function useWatchlist(initial: number[], kind: HomeKind = "film") {
  const [ids, setIds] = useState<Set<number>>(() => new Set(initial));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const flip = (id: number) =>
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function toggle(id: number) {
    flip(id);
    startTransition(async () => {
      try {
        await (kind === "series" ? toggleSeriesWatchlist : toggleWatchlist)(id);
      } catch {
        // Échec (ex. non connecté) → on annule l'affichage optimiste
        flip(id);
        router.push("/login");
      }
    });
  }

  return { has: (id: number) => ids.has(id), toggle, pending };
}
