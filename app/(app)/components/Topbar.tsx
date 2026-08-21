"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import SearchBox from "./SearchBox";
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
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
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
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <div className={styles.topbar}>
      <div className={styles.greet}>
        <div className={styles.hello}>
          <span className={styles.dot} />
          En ligne · {greeting.toLowerCase()}
        </div>
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
      <button className={styles.iconBtn} title="Notifications">
        <BellIcon />
      </button>
    </div>
  );
}
