"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { logout } from "@/app/actions/auth";
import type { LevelInfo } from "@/lib/xp";
import styles from "./AppTopbar.module.css";

/**
 * Compte, en haut à droite de l'en-tête : avatar, puis au clic un menu
 * (niveau, profil, réglages, déconnexion). Remplace le pied de l'ancienne
 * barre latérale.
 */
export default function AccountMenu({
  avatarUrl,
  userName,
  profileHref,
  level,
}: {
  avatarUrl: string | null;
  userName: string | null;
  profileHref: string;
  level: LevelInfo;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (userName ?? "?").charAt(0).toUpperCase();

  return (
    <div className={styles.dropWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.avatarBtn}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Compte de ${userName ?? "l'utilisateur"}`}
      >
        <span className={styles.avatar}>
          {avatarUrl ? <Image src={avatarUrl} alt="" width={40} height={40} className={styles.avatarImg} /> : initial}
        </span>
      </button>
      {open && (
        <div className={`${styles.menu} ${styles.menuRight}`} role="menu">
          <div className={styles.menuHead}>
            <span className={styles.menuName}>{userName ?? "Cinéphile"}</span>
            <span className={styles.menuSub}>
              {level.title} • niv. {level.level}
            </span>
            <span className={styles.xpTrack} title={`${level.currentXP} / ${level.nextLevelXP} XP`}>
              <span className={styles.xpFill} style={{ width: `${level.percent}%` }} />
            </span>
          </div>
          <Link href={profileHref} className={styles.item} role="menuitem" onClick={close}>
            Mon profil
          </Link>
          <Link href="/settings" className={styles.item} role="menuitem" onClick={close}>
            Réglages
          </Link>
          <div className={styles.sep} />
          <form action={logout}>
            <button type="submit" className={`${styles.item} ${styles.logout}`} role="menuitem">
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
