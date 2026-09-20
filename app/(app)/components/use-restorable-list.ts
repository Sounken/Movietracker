"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Conserve une liste paginée et la position de défilement d'une visite à
 * l'autre.
 *
 * Le problème : les grilles gardent les pages chargées dans un état React.
 * Ouvrir une fiche démonte la grille, et le retour arrière la remonte avec ses
 * seules vingt entrées initiales, en haut de page. Quelqu'un qui avait fait
 * défiler dix pages de Découvrir perdait tout à chaque aller-retour.
 *
 * Next restaure bien la position d'un historique, mais il la restaure sur une
 * page qui ne contient plus que le premier écran : il n'y a tout simplement pas
 * de quoi défiler. Rien à régler côté framework, c'est l'état applicatif qu'il
 * faut rendre persistant.
 *
 * `sessionStorage` plutôt que `localStorage` : la reprise n'a de sens que dans
 * l'onglet courant, et le contenu de TMDB change d'un jour à l'autre.
 */

/** Au-delà, la reprise n'a plus de sens : le classement TMDB a bougé. */
const MAX_AGE_MS = 30 * 60 * 1000;

/** Garde-fou : une grille très profonde ne doit pas saturer le stockage. */
const MAX_ITEMS = 400;

type ListState<T> = { items: T[]; page: number; hasMore: boolean };

type Snapshot<T> = ListState<T> & { scrollY: number; savedAt: number };

/**
 * `initialHasMore` est fourni par l'appelant plutôt que déduit d'une taille de
 * page : toutes les grilles ne comptent pas pareil. Celle des sociétés filtre
 * les films sans affiche, donc une page pleine peut en renvoyer moins de vingt
 * et se juge sur un seuil.
 */
export function useRestorableList<T>(key: string, initialItems: T[], initialHasMore: boolean) {
  /**
   * Un seul objet d'état plutôt que trois.
   *
   * La restauration remet en place la liste, la page et la présence d'une
   * suite : en trois `useState` distincts, elle déclenchait trois rendus en
   * cascade — ce que la règle `react-hooks` refuse, à juste titre.
   */
  const [state, setState] = useState<ListState<T>>({
    items: initialItems,
    page: 1,
    hasMore: initialHasMore,
  });

  /** Position à rétablir une fois les éléments remis dans le DOM. */
  const pendingScroll = useRef<number | null>(null);
  const storageKey = `mt:list:${key}`;

  /**
   * Restauration après le montage, et non dans l'initialiseur d'état : lire le
   * stockage au premier rendu donnerait un HTML client différent de celui du
   * serveur, donc un avertissement d'hydratation. L'application est différée
   * d'une frame — le temps que le rendu initial soit peint.
   */
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let snapshot: Snapshot<T> | null = null;
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) snapshot = JSON.parse(raw) as Snapshot<T>;
      } catch {
        // Stockage indisponible (navigation privée, quota) : on repart à neuf.
      }

      if (!snapshot || Date.now() - snapshot.savedAt > MAX_AGE_MS) return;
      // Rien de plus que ce que le serveur a déjà rendu : inutile de réécrire.
      if (snapshot.items.length <= initialItems.length) return;

      pendingScroll.current = snapshot.scrollY;
      setState({ items: snapshot.items, page: snapshot.page, hasMore: snapshot.hasMore });
    });

    return () => cancelAnimationFrame(frame);
    // Volontairement lié à la seule clé : une restauration à chaque changement
    // de props écraserait ce que l'utilisateur vient de charger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  /**
   * Le défilement n'est rétabli qu'une fois les éléments peints, sinon la page
   * est encore trop courte et le navigateur borne la position.
   */
  useEffect(() => {
    if (pendingScroll.current === null) return;
    const target = pendingScroll.current;
    pendingScroll.current = null;
    const frame = requestAnimationFrame(() =>
      window.scrollTo({ top: target, behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [state.items]);

  const setItems: Dispatch<SetStateAction<T[]>> = useCallback((value) => {
    setState((s) => ({
      ...s,
      items: typeof value === "function" ? (value as (prev: T[]) => T[])(s.items) : value,
    }));
  }, []);

  const setPage: Dispatch<SetStateAction<number>> = useCallback((value) => {
    setState((s) => ({
      ...s,
      page: typeof value === "function" ? (value as (prev: number) => number)(s.page) : value,
    }));
  }, []);

  const setHasMore: Dispatch<SetStateAction<boolean>> = useCallback((value) => {
    setState((s) => ({
      ...s,
      hasMore:
        typeof value === "function" ? (value as (prev: boolean) => boolean)(s.hasMore) : value,
    }));
  }, []);

  /** Enregistre l'état courant ; appelé au départ vers une fiche. */
  const save = useCallback(() => {
    try {
      const snapshot: Snapshot<T> = {
        items: state.items.slice(0, MAX_ITEMS),
        page: state.page,
        hasMore: state.hasMore,
        scrollY: window.scrollY,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {
      // Quota dépassé : tant pis pour la reprise, ce n'est pas bloquant.
    }
  }, [state, storageKey]);

  /**
   * On enregistre au démontage plutôt qu'à chaque défilement : c'est le moment
   * où l'état est perdu, quelle que soit la façon de quitter la page, et ça
   * évite d'écrire en continu pendant le scroll.
   *
   * Le `pagehide` ne suffisait pas : il ne se déclenche qu'au déchargement du
   * document. Une navigation interne — un résultat de recherche, le carrousel,
   * un lien de la barre latérale — n'en provoque aucun, et l'état partait alors
   * sans avoir été sauvegardé. Seul le clic sur une carte de la grille était
   * couvert, par son `onClick`.
   *
   * La référence suit la dernière version de `save`, qui change à chaque page
   * chargée : sans elle, l'effet de démontage figerait l'état du premier rendu.
   */
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    const onPageHide = () => saveRef.current();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      saveRef.current();
    };
  }, []);

  return {
    items: state.items,
    setItems,
    page: state.page,
    setPage,
    hasMore: state.hasMore,
    setHasMore,
    save,
  };
}
