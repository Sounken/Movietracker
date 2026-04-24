"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import styles from "./Sidebar.module.css";

const LogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M4 4h4l4 16h4l4-16" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
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
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="m12 2 3 7 7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z" />
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
const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

const mainNav = [
  { href: "/", label: "Accueil", icon: HomeIcon },
  { href: "/discover", label: "Découvrir", icon: FilmIcon },
  { href: "/lists", label: "Mes listes", icon: ListIcon },
  { href: "/rated", label: "Notés", icon: StarIcon },
  { href: "/watchlist", label: "À voir", icon: ClockIcon },
  { href: "/favorites", label: "Favoris", icon: HeartIcon },
];

const socialNav = [
  { href: "/friends", label: "Amis", icon: UsersIcon },
  { href: "/trends", label: "Tendances", icon: TrendIcon },
];

export default function Sidebar({ userName }: { userName: string | null }) {
  const pathname = usePathname();
  const initial = (userName ?? "?")[0].toUpperCase();

  return (
    <aside className={styles.nav}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>
          <LogoIcon />
        </div>
        <div className={styles.brandName}>
          Movie<em>tracker</em>
        </div>
      </div>

      <div className={styles.navSection}>
        <div className={styles.navLabel}>Bibliothèque</div>
        {mainNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${pathname === href ? styles.active : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      <div className={styles.navSection}>
        <div className={styles.navLabel}>Social</div>
        {socialNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${pathname === href ? styles.active : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      <div className={styles.navFoot}>
        <div className={styles.footRow}>
          <div className={styles.avatar}>{initial}</div>
          <div className={styles.footInfo}>
            <div className={styles.footName}>{userName ?? "Cinéphile"}</div>
            <div className={styles.footSub}>cinéphile · niveau 1</div>
          </div>
        </div>
        <form action={logout}>
          <button type="submit" className={styles.logoutBtn} title="Se déconnecter">
            <LogoutIcon />
          </button>
        </form>
      </div>
    </aside>
  );
}
