"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";
import SearchBox from "./SearchBox";
import NotificationsBell from "./NotificationsBell";
import styles from "./Topbar.module.css";

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

type Props = { greeting: string; userName: string | null };

// Le thème vit dans localStorage (système externe) : on s'y abonne via
// useSyncExternalStore. Le snapshot serveur vaut `true` (sombre, le défaut),
// ce qui évite tout mismatch d'hydration.
const THEME_CHANGE_EVENT = "mt-theme-change";
function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

export default function Topbar({ greeting, userName }: Props) {
  // Monde courant : la recherche s'y adapte (mêmes règles que la Sidebar).
  const pathname = usePathname();
  const isSeries = pathname === "/series" || pathname.startsWith("/series/");

  const isDark = useSyncExternalStore(
    subscribeTheme,
    () => localStorage.getItem("mt-theme") !== "light",
    () => true,
  );

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    localStorage.setItem("mt-theme", next);

    // `flushSync` : sans lui, la mise à jour de l'icône soleil/lune part dans
    // le rendu concurrent et arrive après la capture de la transition, qui
    // fige alors l'ancienne icône le temps du fondu.
    const apply = () =>
      flushSync(() => {
        const root = document.documentElement;
        if (next === "light") root.setAttribute("data-theme", "light");
        else root.removeAttribute("data-theme");
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Chrome/Safari : fondu enchaîné natif sur toute la page, bien plus propre
    // qu'une transition CSS qui laisserait chaque élément changer à son rythme.
    if (!reduced && typeof document.startViewTransition === "function") {
      document.startViewTransition(apply);
      return;
    }

    // Firefox et bascule sans animation : on n'anime les couleurs que pendant
    // le basculement, via un attribut retiré juste après (cf. globals.css).
    if (!reduced) {
      const root = document.documentElement;
      root.setAttribute("data-theme-switching", "");
      window.setTimeout(() => root.removeAttribute("data-theme-switching"), 400);
    }
    apply();
  }

  return (
    <div className={styles.topbar}>
      <div className={styles.greet}>
        {/* La ligne « En ligne • bonsoir » a été retirée : elle répétait en
            petit ce que le titre dit juste en dessous, et l'indicateur de
            statut n'apprenait rien — on ne consulte pas l'application en étant
            hors ligne. Le titre porte seul la salutation, désormais déclinée
            par tranche horaire (cf. lib/greeting.ts). */}
        <h1 className={styles.title}>
          {userName ? (
            <>
              {greeting}, <em>{userName}</em>.
            </>
          ) : (
            "Bienvenue"
          )}
        </h1>
      </div>

      <SearchBox scope={isSeries ? "series" : "films"} />

      <button className={styles.iconBtn} title={isDark ? "Passer en clair" : "Passer en sombre"} onClick={toggleTheme}>
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
      {/* `userName` sert d'indice d'authentification : le prénom est exigé à
          l'inscription, et la barre ne le reçoit que pour une session ouverte.
          Un visiteur anonyme ne déclenche donc aucune requête. */}
      <NotificationsBell enabled={!!userName} buttonClassName={styles.iconBtn} />
    </div>
  );
}
