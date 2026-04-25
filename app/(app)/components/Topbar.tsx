"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./Topbar.module.css";

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

type SearchResult = { id: number; title: string; year: string; posterUrl: string; voteAverage: number | null };
type Props = { greeting: string; userName: string | null };

export default function Topbar({ greeting, userName }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("mt-theme");
    setIsDark(stored !== "light");
  }, []);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    setIsDark(!isDark);
    localStorage.setItem("mt-theme", next);
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data: SearchResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navigate = (id: number) => {
    setQuery("");
    setOpen(false);
    router.push(`/film/${id}`);
  };

  return (
    <div className={styles.topbar}>
      <div className={styles.greet}>
        <div className={styles.hello}>
          <span className={styles.dot} />
          En ligne · {greeting.toLowerCase()}
        </div>
        <h1 className={styles.title}>
          {greeting}, <em>{userName ?? "Cinéphile"}</em>.
        </h1>
      </div>

      <div className={styles.searchWrap} ref={containerRef}>
        <div className={styles.search}>
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Chercher un film, un réalisateur…"
            className={styles.searchInput}
          />
          <span className={styles.kbd}>⌘K</span>
        </div>

        {open && results.length > 0 && (
          <div className={styles.dropdown}>
            {results.map((m) => (
              <div key={m.id} className={styles.result} onClick={() => navigate(m.id)}>
                {m.posterUrl ? (
                  <div className={styles.thumb} style={{ backgroundImage: `url("${m.posterUrl}")` }} />
                ) : (
                  <div className={`${styles.thumb} ${styles.thumbEmpty}`} />
                )}
                <div className={styles.resultInfo}>
                  <div className={styles.resultTitle}>{m.title}</div>
                  {m.year && <div className={styles.resultMeta}>{m.year}</div>}
                </div>
                {m.voteAverage != null && m.voteAverage > 0 && (
                  <div className={styles.resultRating}>
                    <span className={styles.resultStar}>★</span>
                    {m.voteAverage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button className={styles.iconBtn} title={isDark ? "Passer en clair" : "Passer en sombre"} onClick={toggleTheme}>
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
      <button className={styles.iconBtn} title="Notifications">
        <BellIcon />
      </button>
    </div>
  );
}
