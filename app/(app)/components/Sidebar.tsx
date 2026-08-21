"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import type { LevelInfo } from "@/lib/xp";
import styles from "./Sidebar.module.css";
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />
  </svg>
);
const FilmIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M3 15h18M8 4v16M16 4v16" />
  </svg>
);
const ListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const TrendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M14 7h7v7" />
  </svg>
);
const TvIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="m17 2-5 5-5-5" />
  </svg>
);
const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

type Counts = { watchlist: number; liked: number };
type NavItem = {
  href: string;
  label: string;
  icon: ComponentType;
  countKey?: keyof Counts;
  authOnly: boolean;
};

const filmNav: NavItem[] = [
  { href: "/films", label: "Accueil", icon: HomeIcon, authOnly: true },
  { href: "/films/discover", label: "Découvrir", icon: FilmIcon, authOnly: false },
  { href: "/films/lists", label: "Mes listes", icon: ListIcon, authOnly: true },
  { href: "/films/watchlist", label: "À voir", icon: ClockIcon, countKey: "watchlist" as keyof Counts, authOnly: true },
  { href: "/films/favorites", label: "Favoris", icon: HeartIcon, countKey: "liked" as keyof Counts, authOnly: true },
];

// Monde Séries (les listes séries arriveront dans un lot dédié)
const seriesNav: NavItem[] = [
  { href: "/series", label: "Accueil", icon: HomeIcon, authOnly: true },
  { href: "/series/discover", label: "Découvrir", icon: TvIcon, authOnly: false },
  { href: "/series/watchlist", label: "À voir", icon: ClockIcon, countKey: "watchlist", authOnly: true },
  { href: "/series/favorites", label: "Favoris", icon: HeartIcon, countKey: "liked", authOnly: true },
];

const filmSocial: NavItem[] = [
  { href: "/friends", label: "Amis", icon: UsersIcon, authOnly: true },
  { href: "/films/trends", label: "Tendances", icon: TrendIcon, authOnly: false },
];
const seriesSocial: NavItem[] = [
  { href: "/series/friends", label: "Amis", icon: UsersIcon, authOnly: true },
  { href: "/series/trends", label: "Tendances", icon: TrendIcon, authOnly: false },
];

const LoginIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="16" height="16">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

// Onglets gardés dans la barre du bas sur mobile (les autres passent dans le menu).
const MOBILE_PRIMARY_AUTH = ["/films", "/films/discover", "/films/watchlist"];
const MOBILE_PRIMARY_GUEST = ["/films/discover", "/films/trends"];

export default function Sidebar({
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
  const initial = (userName ?? "?")[0].toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);

  // Section courante : monde Films (défaut) ou Séries
  const isSeries = pathname === "/series" || pathname.startsWith("/series/");
  const mainNav = isSeries ? seriesNav : filmNav;
  const socialNav = isSeries ? seriesSocial : filmSocial;
  const sectionHome = isSeries ? "/series" : "/films";
  const profileHref = isSeries ? "/series/profile" : "/films/profile";
  // Compteurs et niveau du monde courant
  const activeCounts = isSeries ? seriesCounts : counts;
  const activeLevel = isSeries ? seriesLevel : levelInfo;

  // Onglets visibles dans la barre du bas mobile ; le reste va dans le menu.
  const primaryHrefs = isSeries
    ? ["/series", "/series/discover"]
    : isAuthenticated
      ? MOBILE_PRIMARY_AUTH
      : MOBILE_PRIMARY_GUEST;
  const isPrimary = (href: string) => primaryHrefs.includes(href);

  const visibleNav = [...mainNav, ...socialNav].filter(
    ({ authOnly }) => !authOnly || isAuthenticated,
  );
  const menuItems = visibleNav.filter(({ href }) => !isPrimary(href));


  return (
    <aside className={styles.nav}>
      <Link href={sectionHome} className={styles.brand} aria-label="Accueil">
        <div className={styles.brandMark}>
          <Image src="/logo.png" alt="Movietracker" width={34} height={31} priority />
        </div>
        <div className={styles.brandName}>
          Movie<em>tracker</em>
        </div>
      </Link>

      {/* Switch Films / Séries — deux mondes distincts.
          `data-side` pilote la pastille glissante (cf. .switchThumb). */}
      <div className={styles.sectionSwitch} data-side={isSeries ? "series" : "films"}>
        <span className={styles.switchThumb} aria-hidden="true" />
        <Link
          href="/films"
          className={`${styles.switchBtn} ${!isSeries ? styles.switchOn : ""}`}
        >
          <FilmIcon />
          <span>Films</span>
        </Link>
        <Link
          href="/series"
          className={`${styles.switchBtn} ${isSeries ? styles.switchOn : ""}`}
        >
          <TvIcon />
          <span>Séries</span>
        </Link>
      </div>

      <div className={styles.navSection}>
        <div className={styles.navLabel}>Bibliothèque</div>
        {mainNav.filter(({ authOnly }) => !authOnly || isAuthenticated).map(({ href, label, icon: Icon, countKey }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${pathname === href ? styles.active : ""} ${isPrimary(href) ? "" : styles.hideOnMobile}`}
          >
            <Icon />
            <span>{label}</span>
            {countKey && activeCounts[countKey] > 0 && (
              <span className={styles.count}>{activeCounts[countKey]}</span>
            )}
          </Link>
        ))}
      </div>

      <div className={styles.navSection}>
        <div className={styles.navLabel}>Social</div>
        {socialNav.filter(({ authOnly }) => !authOnly || isAuthenticated).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${pathname === href ? styles.active : ""} ${isPrimary(href) ? "" : styles.hideOnMobile}`}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      {/* Accès rapide mobile : la barre du bas masque le pied de page (profil / connexion) */}
      <div className={styles.mobileOnly}>
        {isAuthenticated ? (
          <Link
            href={profileHref}
            className={`${styles.navItem} ${pathname === profileHref ? styles.active : ""}`}
            aria-label="Mon profil"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" className={styles.navAvatar} width={24} height={24} />
            ) : (
              <UserIcon />
            )}
            <span>Profil</span>
          </Link>
        ) : (
          <Link
            href="/login"
            className={`${styles.navItem} ${pathname === "/login" ? styles.active : ""}`}
            aria-label="Se connecter"
          >
            <LoginIcon />
            <span>Connexion</span>
          </Link>
        )}

        {/* Onglet « Menu » : regroupe les entrées secondaires */}
        {menuItems.length > 0 && (
          <button
            type="button"
            className={styles.navItem}
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <MenuIcon />
            <span>Menu</span>
          </button>
        )}
      </div>

      {/* Feuille du menu mobile */}
      {menuOpen && (
        <div className={styles.sheetBackdrop} onClick={() => setMenuOpen(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            {/* Switch Films / Séries (mobile) */}
            <div
              className={styles.sectionSwitchSheet}
              data-side={isSeries ? "series" : "films"}
            >
              <span className={styles.switchThumb} aria-hidden="true" />
              <Link
                href="/films"
                className={`${styles.switchBtn} ${!isSeries ? styles.switchOn : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                <FilmIcon /> <span>Films</span>
              </Link>
              <Link
                href="/series"
                className={`${styles.switchBtn} ${isSeries ? styles.switchOn : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                <TvIcon /> <span>Séries</span>
              </Link>
            </div>
            {menuItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={styles.sheetItem}
                onClick={() => setMenuOpen(false)}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            ))}
            {isAuthenticated && (
              <form action={logout}>
                <button type="submit" className={styles.sheetItem}>
                  <LogoutIcon />
                  <span>Se déconnecter</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <div className={styles.navFoot}>
        {isAuthenticated ? (
          <>
            <Link href={profileHref} className={styles.footRow}>
              <div className={styles.avatar}>
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={userName ?? "Profil"} className={styles.avatarImg} width={36} height={36} />
                ) : (
                  initial
                )}
              </div>
              <div className={styles.footInfo}>
                <div className={styles.footName}>{userName ?? "Cinéphile"}</div>
                <div className={styles.footSub}>
                  {activeLevel.title} · niv. {activeLevel.level}
                </div>
                <div className={styles.xpBarWrap} title={`${activeLevel.currentXP} / ${activeLevel.nextLevelXP} XP`}>
                  <div className={styles.xpBar} style={{ width: `${activeLevel.percent}%` }} />
                </div>
              </div>
            </Link>
            <form action={logout}>
              <button type="submit" className={styles.logoutBtn} title="Se déconnecter">
                <LogoutIcon />
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className={styles.loginBtn}>
            <LoginIcon />
            <span>Se connecter</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
