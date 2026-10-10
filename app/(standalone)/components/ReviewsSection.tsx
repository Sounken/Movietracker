"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import filmStyles from "../film/[id]/film.module.css";
import styles from "./ReviewsSection.module.css";
import { Rating } from "@/lib/rating-scale";
import type { ReviewCard } from "@/lib/reviews";

const INITIAL_COUNT = 3;
/** Sous ce seuil le texte tient dans la hauteur repliée : pas de « Lire la suite ». */
const LONG_REVIEW = 420;

/**
 * Avis sur un film ou une série : ceux des amis d'abord, puis ceux de TMDB.
 *
 * Les avis TMDB comblent le vide tant que la communauté est petite. Ils sont
 * presque tous en anglais, et l'étiquette le dit : un lecteur qui tombe sur un
 * pavé en anglais sans prévenir croit à un bug de traduction.
 */
export default function ReviewsSection({ reviews }: { reviews: ReviewCard[] }) {
  const [expanded, setExpanded] = useState(false);
  const [opened, setOpened] = useState<Set<string>>(() => new Set());

  if (reviews.length === 0) return null;

  const visible = expanded ? reviews : reviews.slice(0, INITIAL_COUNT);
  const remaining = reviews.length - INITIAL_COUNT;

  function toggle(id: string) {
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={filmStyles.section}>
      <div className={filmStyles.sectionTitle}>Avis</div>
      <div className={filmStyles.friendReviews}>
        {visible.map((r) => {
          const long = r.content.length > LONG_REVIEW;
          const open = opened.has(r.id);
          const author = (
            <>
              {r.avatarUrl ? (
                <Image src={r.avatarUrl} alt="" className={filmStyles.friendAvatar} width={34} height={34} />
              ) : (
                <div className={filmStyles.friendAvatarFallback}>{r.name[0]?.toUpperCase()}</div>
              )}
              <span className={filmStyles.friendName}>{r.name}</span>
            </>
          );

          return (
            <article key={r.id} className={filmStyles.friendReview}>
              <div className={filmStyles.friendReviewHead}>
                {r.href && r.source === "friend" ? (
                  <Link href={r.href} className={filmStyles.friendReviewUser}>
                    {author}
                  </Link>
                ) : (
                  <div className={filmStyles.friendReviewUser}>{author}</div>
                )}
                {r.rating != null && (
                  <span className={filmStyles.friendRating}>
                    ★ <Rating value={r.rating} />
                  </span>
                )}
                <span className={styles.source}>{r.source === "friend" ? "Ami" : "TMDB · en anglais"}</span>
              </div>

              {r.content && (
                <p className={`${filmStyles.friendReviewText} ${styles.text} ${long && !open ? styles.clamped : ""}`}>
                  {r.content}
                </p>
              )}
              {long && (
                <button type="button" className={styles.readMore} onClick={() => toggle(r.id)}>
                  {open ? "Réduire" : "Lire la suite"}
                </button>
              )}

              <div className={filmStyles.friendReviewDate}>
                {r.date}
                {r.source === "tmdb" && r.href && (
                  <>
                    {" · "}
                    <a href={r.href} target="_blank" rel="noopener noreferrer" className={styles.origin}>
                      voir sur TMDB
                    </a>
                  </>
                )}
              </div>
            </article>
          );
        })}

        {remaining > 0 && (
          <button
            type="button"
            className={`${filmStyles.friendReview} ${filmStyles.friendReviewMore}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Réduire" : `Afficher plus d'avis (${remaining})`}
          </button>
        )}
      </div>
    </div>
  );
}
