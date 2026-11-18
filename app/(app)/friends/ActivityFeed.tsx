"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { SmilePlus } from "lucide-react";
import { loadMoreActivity, toggleReaction } from "@/app/actions/activity";
import type { FeedItem, ReactionSummary } from "@/lib/activity";
import { Rating } from "@/lib/rating-scale";
import { formatWatchDate } from "@/lib/watch-date";
import styles from "./ActivityFeed.module.css";

// Recopiée de lib/activity (module serveur) : le sélecteur en a besoin ici.
const EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏"];

function timeAgo(iso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `Il y a ${d} j`;
  return formatWatchDate(iso);
}

function verb(item: FeedItem, media: "movie" | "tv") {
  if (item.kind === "rewatched") return "a revu";
  if (item.kind === "watched") return "a vu";
  return media === "tv" ? "a noté la série" : "a noté";
}

function Reactions({ item }: { item: FeedItem }) {
  const [reactions, setReactions] = useState<ReactionSummary[]>(item.reactions);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPickerOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const toggle = (emoji: string) => {
    setPickerOpen(false);
    const previous = reactions;
    // Optimiste : la pastille réagit au clic, le serveur confirme ensuite.
    const current = reactions.find((r) => r.emoji === emoji);
    const next = current
      ? reactions
          .map((r) => (r.emoji === emoji ? { ...r, count: r.count + (r.mine ? -1 : 1), mine: !r.mine } : r))
          .filter((r) => r.count > 0)
      : [...reactions, { emoji, count: 1, mine: true }].sort(
          (a, b) => EMOJIS.indexOf(a.emoji) - EMOJIS.indexOf(b.emoji),
        );
    setReactions(next);
    startTransition(async () => {
      try {
        setReactions(await toggleReaction(item.id, emoji));
      } catch {
        setReactions(previous);
      }
    });
  };

  return (
    <div className={styles.reactions} ref={wrapRef}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className={`${styles.chip} ${r.mine ? styles.chipMine : ""}`}
          onClick={() => toggle(r.emoji)}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}${r.mine ? ", dont la vôtre" : ""}`}
        >
          <span>{r.emoji}</span>
          <span className={styles.chipCount}>{r.count}</span>
        </button>
      ))}
      <button
        type="button"
        className={styles.addReaction}
        onClick={() => setPickerOpen((o) => !o)}
        aria-label="Réagir"
        aria-expanded={pickerOpen}
        title="Réagir"
      >
        <SmilePlus size={15} />
      </button>
      {pickerOpen && (
        <div className={styles.picker} role="menu">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              className={styles.pickerItem}
              onClick={() => toggle(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ActivityFeed({
  initialItems,
  initialHasMore,
  media,
  mediaBase,
  profileBase,
}: {
  initialItems: FeedItem[];
  initialHasMore: boolean;
  media: "movie" | "tv";
  /** « /film » ou « /series ». */
  mediaBase: string;
  /** « /user » ou « /series/user ». */
  profileBase: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  const selfHref = media === "tv" ? "/series/profile" : "/films/profile";

  // Lien d'une notification de réaction : on amène l'activité à l'écran.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id.startsWith("activite-")) {
      document.getElementById(id)?.scrollIntoView({ block: "center" });
    }
  }, []);

  const more = () =>
    startTransition(async () => {
      const page = await loadMoreActivity(media, items.at(-1)!.id);
      setItems((prev) => [...prev, ...page.items]);
      setHasMore(page.hasMore);
    });

  if (items.length === 0) {
    return <div className={styles.empty}>Aucune activité récente.</div>;
  }

  return (
    <div className={styles.feed}>
      {items.map((item) => (
        <article key={item.id} id={`activite-${item.id}`} className={styles.item}>
          <Link href={item.isMine ? selfHref : `${profileBase}/${item.user.id}`} className={styles.avatar}>
            {item.user.avatarUrl ? (
              <Image src={item.user.avatarUrl} alt="" width={36} height={36} className={styles.avatarImg} />
            ) : (
              <span>{item.user.name.charAt(0).toUpperCase()}</span>
            )}
          </Link>

          <div className={styles.body}>
            <div className={styles.line}>
              {item.isMine ? (
                <strong className={styles.name}>Vous</strong>
              ) : (
                <Link href={`${profileBase}/${item.user.id}`} className={styles.name}>
                  {item.user.name}
                </Link>
              )}{" "}
              {item.isMine ? verb(item, media).replace(/^a /, "avez ") : verb(item, media)}{" "}
              <Link href={`${mediaBase}/${item.tmdbId}`} className={styles.title}>
                {item.title}
              </Link>
              {item.year && <span className={styles.year}> ({item.year})</span>}
            </div>

            {(item.rating != null || item.watchedAt) && (
              <div className={styles.meta}>
                {item.rating != null && (
                  <span className={styles.rating}>★ <Rating value={item.rating} /></span>
                )}
                {item.watchedAt && <span>le {formatWatchDate(item.watchedAt)}</span>}
                {item.note && <span className={styles.note}>· {item.note}</span>}
              </div>
            )}

            {item.review && <p className={styles.review}>{item.review}</p>}

            <div className={styles.foot}>
              <span className={styles.time}>{timeAgo(item.createdAt)}</span>
              <Reactions item={item} />
            </div>
          </div>

          {item.posterUrl && (
            <Link href={`${mediaBase}/${item.tmdbId}`} className={styles.poster}>
              <Image src={item.posterUrl} alt="" fill sizes="44px" style={{ objectFit: "cover" }} />
            </Link>
          )}
        </article>
      ))}

      {hasMore && (
        <button type="button" className={styles.more} onClick={more} disabled={isPending}>
          {isPending ? "Chargement…" : "Voir plus"}
        </button>
      )}
    </div>
  );
}
