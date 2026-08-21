"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Loader2 } from "lucide-react";
import type { TmdbFilmCard } from "@/lib/tmdb";
import { Rating } from "@/lib/rating-scale";
import styles from "../../../(app)/films/discover/discover.module.css";

export default function CompanyFilmsGrid({
  companyId,
  initialFilms,
}: {
  companyId: number;
  initialFilms: TmdbFilmCard[];
}) {
  const [films, setFilms] = useState(initialFilms);
  const [page, setPage] = useState(1);
  // TMDB renvoie 20 résultats par page ; on filtre ceux sans affiche, donc
  // une page pleine peut en compter moins. On se base sur le brut de l'API
  // via un seuil bas plutôt que sur l'égalité stricte.
  const [hasMore, setHasMore] = useState(initialFilms.length >= 15);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const nextPage = page + 1;
    fetch(`/api/company/${companyId}?page=${nextPage}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((more: TmdbFilmCard[]) => {
        setFilms((prev) => [...prev, ...more]);
        setPage(nextPage);
        if (more.length < 15) setHasMore(false);
      })
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
  }, [companyId, page]);

  const sentinelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (films.length === 0) {
    return <div className={styles.empty}>Aucun film référencé pour cette société.</div>;
  }

  return (
    <div className={`${styles.grid} stagger`}>
      {films.map((film) => (
        <Link key={film.id} href={`/film/${film.id}`} className={styles.filmCard}>
          <div className={styles.poster}>
            {film.posterUrl && (
              <Image
                src={film.posterUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 200px"
                style={{ objectFit: "cover" }}
              />
            )}
            {film.voteAverage > 0 && (
              <div className={styles.score}>★ <Rating value={film.voteAverage} /></div>
            )}
          </div>
          <div className={styles.info}>
            <div className={styles.title}>{film.title}</div>
            {film.year && <div className={styles.year}>{film.year}</div>}
          </div>
        </Link>
      ))}

      {hasMore && (
        <button
          ref={sentinelRef}
          className={`${styles.filmCard} ${styles.loadMoreCard}`}
          onClick={loadMore}
          disabled={loading}
        >
          <div className={styles.loadMorePoster}>
            {loading ? <Loader2 size={28} className={styles.spin} /> : <Plus size={36} />}
          </div>
          <div className={styles.info}>
            <div className={styles.title}>{loading ? "Chargement…" : "Afficher plus"}</div>
          </div>
        </button>
      )}
    </div>
  );
}
