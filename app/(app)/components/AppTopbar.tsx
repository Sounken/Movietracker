"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { LevelInfo } from "@/lib/xp";
import NotificationsBell from "./NotificationsBell";
import SearchToggle from "./SearchToggle";
import AccountMenu from "./AccountMenu";
import styles from "./AppTopbar.module.css";

type Counts = { watchlist: number; liked: number };
type Item = { href: string; label: string; count?: keyof Counts; authOnly?: boolean };

/** Entrées visibles dans la barre ; les autres passent dans « Plus ». */
const FILM_MAIN: Item[] = [
  { href: "/films", label: "Accueil", authOnly: true },
  { href: "/films/discover", label: "Découvrir" },
  { href: "/films/lists", label: "Mes listes", authOnly: true },
  { href: "/friends", label: "Amis", authOnly: true },
  { href: "/films/calendrier", label: "Calendrier", authOnly: true },
  { href: "/films/watchlist", label: "À voir", count: "watchlist", authOnly: true },
];
const FILM_MORE: Item[] = [
  { href: "/films/favorites", label: "Favoris", count: "liked", authOnly: true },
  { href: "/films/journal", label: "Journal", authOnly: true },
  { href: "/films/ce-soir", label: "Ce soir", authOnly: true },
  { href: "/films/trends", label: "Tendances" },
  { href: "/moviedle", label: "Moviedle" },
];
const SERIES_MAIN: Item[] = [
  { href: "/series", label: "Accueil", authOnly: true },
  { href: "/series/discover", label: "Découvrir" },
  { href: "/series/calendrier", label: "Calendrier", authOnly: true },
  { href: "/series/watchlist", label: "À voir", count: "watchlist", authOnly: true },
  { href: "/series/favorites", label: "Favoris", count: "liked", authOnly: true },
];
const SERIES_MORE: Item[] = [
  { href: "/series/friends", label: "Amis", authOnly: true },
  { href: "/series/trends", label: "Tendances" },
  { href: "/series/moviedle", label: "Moviedle" },
];

/**
 * En-tête de l'application, direction Nocturne : marque, Films / Séries,
 * navigation, recherche, notifications, compte. Il remplace la barre latérale
 * sur grand écran (elle ne sert plus que de barre du bas sur mobile).
 *
 * Transparent en haut de page — posé sur l'image quand la page a un hero
 * (`data-hero`, cf. app.module.css) — il passe en verre sombre dès qu'on
 * défile.
 */
export default function AppTopbar({
  isAuthenticated,
  userName,
  avatarUrl,
  counts,
  seriesCounts,
  levelInfo,
  seriesLevel,
}: {
  isAuthenticated: boolean;
  userName: string | null;
  avatarUrl: string | null;
  counts: Counts;
  seriesCounts: Counts;
  levelInfo: LevelInfo;
  seriesLevel: LevelInfo;
}) {
  const pathname = usePathname();
  const isSeries = pathname === "/series" || pathname.startsWith("/series/");
  const activeCounts = isSeries ? seriesCounts : counts;
  const visible = (i: Item) => !i.authOnly || isAuthenticated;
  const main = (isSeries ? SERIES_MAIN : FILM_MAIN).filter(visible);
  const more = (isSeries ? SERIES_MORE : FILM_MORE).filter(visible);
  const isOn = (href: string) => pathname === href;
  const moreOn = more.some((i) => isOn(i.href));
  const hasMore = more.length > 0 || main.length > 3;

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (e: MouseEvent) => !moreRef.current?.contains(e.target as Node) && setMoreOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);
  // Une navigation referme le menu
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMoreOpen(false);
  }

  const label = (i: Item) => (
    <>
      {i.label}
      {i.count && activeCounts[i.count] > 0 ? <span className={styles.count}>{activeCounts[i.count]}</span> : null}
    </>
  );

  return (
    <header className={`${styles.bar} ${scrolled ? styles.scrolled : ""}`} data-scrolled={scrolled || undefined}>
      {/* Marque de toujours : logo + « Movie<em>tracker</em> », comme dans
          l'ancienne barre latérale. */}
      <Link href={isSeries ? "/series" : isAuthenticated ? "/films" : "/films/discover"} className={styles.brand} aria-label="Accueil">
        <span className={styles.brandMark}>
          <Image src="/logo.png" alt="" width={68} height={62} priority />
        </span>
        <span className={styles.brandName}>
          Movie<em>tracker</em>
        </span>
      </Link>

      <div role="group" aria-label="Monde" className={styles.world} data-side={isSeries ? "series" : "films"}>
        <span className={styles.worldThumb} aria-hidden="true" />
        <Link href="/films" className={`${styles.worldBtn} ${!isSeries ? styles.worldOn : ""}`}>Films</Link>
        <Link href="/series" className={`${styles.worldBtn} ${isSeries ? styles.worldOn : ""}`}>Séries</Link>
      </div>

      <nav className={styles.nav} aria-label="Navigation">
        {main.map((i) => (
          <Link key={i.href} href={i.href} className={isOn(i.href) ? styles.navOn : undefined} aria-current={isOn(i.href) ? "page" : undefined}>
            {label(i)}
          </Link>
        ))}
        {hasMore && (
          <div className={`${styles.dropWrap} ${more.length === 0 ? styles.compactOnly : ""}`} ref={moreRef}>
            <button
              type="button"
              className={`${styles.moreBtn} ${moreOn ? styles.navOn : ""}`}
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              Plus
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {moreOpen && (
              <div className={styles.menu} role="menu">
                {/* Entrées de la barre masquées faute de place (cf. CSS) */}
                {main.slice(3).map((i) => (
                  <Link key={i.href} href={i.href} role="menuitem" className={`${styles.item} ${styles.itemCompact} ${isOn(i.href) ? styles.itemOn : ""}`}>
                    {label(i)}
                  </Link>
                ))}
                {more.map((i) => (
                  <Link key={i.href} href={i.href} role="menuitem" className={`${styles.item} ${isOn(i.href) ? styles.itemOn : ""}`}>
                    {label(i)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <span className={styles.spacer} />

      <SearchToggle scope={isSeries ? "series" : "films"} />
      <NotificationsBell enabled={isAuthenticated} buttonClassName={styles.ic} />
      {isAuthenticated ? (
        <AccountMenu
          avatarUrl={avatarUrl}
          userName={userName}
          profileHref={isSeries ? "/series/profile" : "/films/profile"}
          level={isSeries ? seriesLevel : levelInfo}
        />
      ) : (
        <Link href="/login" className={styles.login}>Se connecter</Link>
      )}
    </header>
  );
}
