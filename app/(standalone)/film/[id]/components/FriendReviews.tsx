"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "../film.module.css";

export type FriendReview = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  review: string | null;
  date: string;
};

const INITIAL_COUNT = 2;

export default function FriendReviews({ reviews }: { reviews: FriendReview[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, INITIAL_COUNT);
  const remaining = reviews.length - INITIAL_COUNT;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Ce qu&apos;en pensent tes amis</div>
      <div className={styles.friendReviews}>
        {visible.map((f) => (
          <div key={f.userId} className={styles.friendReview}>
            <div className={styles.friendReviewHead}>
              <Link href={`/user/${f.userId}`} className={styles.friendReviewUser}>
                {f.avatarUrl ? (
                  <Image src={f.avatarUrl} alt={f.name} className={styles.friendAvatar} width={34} height={34} />
                ) : (
                  <div className={styles.friendAvatarFallback}>
                    {f.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <span className={styles.friendName}>{f.name}</span>
              </Link>
              {f.rating != null && (
                <span className={styles.friendRating}>★ {f.rating}</span>
              )}
            </div>
            {f.review && <p className={styles.friendReviewText}>{f.review}</p>}
            <div className={styles.friendReviewDate}>{f.date}</div>
          </div>
        ))}

        {/* Load more / collapse card — même style qu'une carte d'avis */}
        {remaining > 0 && (
          <button
            className={`${styles.friendReview} ${styles.friendReviewMore}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Réduire" : `Afficher plus d'avis (${remaining})`}
          </button>
        )}
      </div>
    </div>
  );
}
