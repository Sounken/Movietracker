"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./discover.module.css";

const CATEGORIES = [
  { id: "popular", label: "Populaires" },
  { id: "top_rated", label: "Mieux notés" },
  { id: "now_playing", label: "En salle" },
  { id: "upcoming", label: "À venir" },
];

const GENRE_LIST = [
  { id: 28, name: "Action" },
  { id: 12, name: "Aventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comédie" },
  { id: 80, name: "Crime" },
  { id: 18, name: "Drame" },
  { id: 14, name: "Fantastique" },
  { id: 27, name: "Horreur" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science-Fiction" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "Guerre" },
  { id: 37, name: "Western" },
];

export default function DiscoverFilters({
  category,
  genre,
}: {
  category: string;
  genre: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/discover?${params.toString()}`);
  };

  return (
    <div className={styles.filters}>
      <div className={styles.categoryTabs}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`${styles.tab} ${category === cat.id ? styles.tabOn : ""}`}
            onClick={() => setParam("category", cat.id === "popular" ? "" : cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className={styles.genreRow}>
        {GENRE_LIST.map((g) => (
          <button
            key={g.id}
            className={`${styles.pill} ${genre === String(g.id) ? styles.pillOn : ""}`}
            onClick={() => setParam("genre", genre === String(g.id) ? "" : String(g.id))}
          >
            {g.name}
          </button>
        ))}
      </div>
    </div>
  );
}
