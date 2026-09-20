"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./NotificationsBell.module.css";

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

type Notification = {
  id: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; name: string | null; avatarUrl: string | null };
};

/** « il y a 3 h », « il y a 2 j » — plus lisible qu'une date pour du récent. */
const RELATIVE = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.35],
    ["month", 12],
  ];

  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return RELATIVE.format(-Math.round(value), unit);
    value /= size;
  }
  return RELATIVE.format(-Math.round(value), "year");
}

/**
 * Cloche des notifications.
 *
 * Elle existait déjà dans la barre supérieure, mais n'était qu'un pictogramme :
 * aucun clic, aucune donnée derrière. Personne n'était donc prévenu qu'un autre
 * utilisateur venait de s'abonner.
 *
 * `enabled` évite tout appel réseau pour un visiteur anonyme — un robot qui
 * parcourt les fiches ne doit pas déclencher une requête par page. La route
 * répond de toute façon une liste vide sans toucher la base, c'est une seconde
 * barrière.
 */
export default function NotificationsBell({
  enabled,
  buttonClassName,
}: {
  enabled: boolean;
  buttonClassName?: string;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { items: [], unread: 0 }))
      .then((data: { items: Notification[]; unread: number }) => {
        if (cancelled) return;
        setItems(data.items);
        setUnread(data.unread);
        setLoaded(true);
      })
      .catch(() => {
        // Une cloche muette vaut mieux qu'une erreur : rien à signaler ici.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Fermeture au clic extérieur, comme le menu de recherche.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /** Ouvrir vaut lecture : le compteur retombe et le serveur est prévenu. */
  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (!wasOpen && unread > 0) {
        setUnread(0);
        setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
        void fetch("/api/notifications", { method: "POST" }).catch(() => {});
      }
      return !wasOpen;
    });
  }, [unread]);

  if (!enabled) return null;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={buttonClassName}
        onClick={toggle}
        title="Notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}
        aria-expanded={open}
      >
        <BellIcon />
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Notifications</div>

          {!loaded && <div className={styles.empty}>Chargement…</div>}
          {loaded && items.length === 0 && (
            <div className={styles.empty}>Rien de neuf pour l&apos;instant.</div>
          )}

          {items.map((n) => (
            <Link
              key={n.id}
              href={`/user/${n.actor.id}`}
              className={`${styles.item} ${n.readAt ? "" : styles.itemUnread}`}
              onClick={() => setOpen(false)}
            >
              {n.actor.avatarUrl ? (
                <Image
                  src={n.actor.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className={styles.avatar}
                />
              ) : (
                <div className={`${styles.avatar} ${styles.avatarEmpty}`}>
                  {(n.actor.name ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className={styles.text}>
                <strong>{n.actor.name ?? "Quelqu'un"}</strong> s&apos;est abonné à vous.
                <div className={styles.time}>{relativeTime(n.createdAt)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
