"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Rating } from "@/lib/rating-scale";
import styles from "./SearchBox.module.css";

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

type SearchResult = {
  id: number;
  mediaType?: "movie" | "tv";
  title: string;
  year: string;
  posterUrl: string;
  voteAverage: number | null;
};

/**
 * Recherche films / séries, extraite de la Topbar d'accueil pour être
 * réutilisable telle quelle sur les fiches film et série.
 * `compact` réduit la largeur pour tenir dans la barre d'une fiche.
 */
export default function SearchBox({
  placeholder = "Chercher un film, un réalisateur…",
  compact = false,
}: {
  placeholder?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Recherche débouncée
  useEffect(() => {
    if (query.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?type=multi&q=${encodeURIComponent(query)}`);
        const data: SearchResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fermeture au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navigate = (id: number, mediaType?: "movie" | "tv") => {
    setQuery("");
    setOpen(false);
    router.push(mediaType === "tv" ? `/series/${id}` : `/film/${id}`);
  };

  return (
    <div className={`${styles.searchWrap} ${compact ? styles.compact : ""}`} ref={containerRef}>
      <div className={styles.search}>
        <SearchIcon />
        <input
          value={query}
          onChange={(e) => {
            const q = e.target.value;
            setQuery(q);
            if (q.length < 2) { setResults([]); setOpen(false); }
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          placeholder={placeholder}
          aria-label="Rechercher un film ou une série"
          className={styles.searchInput}
        />
      </div>

      {open && results.length > 0 && (
        <div className={styles.dropdown}>
          {results.map((m) => (
            <div
              key={`${m.mediaType ?? "movie"}-${m.id}`}
              className={styles.result}
              onClick={() => navigate(m.id, m.mediaType)}
            >
              {m.posterUrl ? (
                <Image
                  src={m.posterUrl}
                  alt=""
                  className={styles.thumb}
                  width={36}
                  height={54}
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div className={`${styles.thumb} ${styles.thumbEmpty}`} />
              )}
              <div className={styles.resultInfo}>
                <div className={styles.resultTitle}>{m.title}</div>
                <div className={styles.resultMeta}>
                  {m.mediaType === "tv" ? "Série" : "Film"}{m.year ? ` · ${m.year}` : ""}
                </div>
              </div>
              {m.voteAverage != null && m.voteAverage > 0 && (
                <div className={styles.resultRating}>
                  <span className={styles.resultStar}>★</span>
                  <Rating value={m.voteAverage} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
