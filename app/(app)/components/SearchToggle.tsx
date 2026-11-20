"use client";

import { useEffect, useRef, useState } from "react";
import SearchBox from "./SearchBox";
import styles from "./AppTopbar.module.css";

/**
 * Loupe de l'en-tête : un pictogramme qui déplie la recherche globale
 * habituelle (`SearchBox`) en dessous. Raccourci clavier : « / ».
 */
export default function SearchToggle({ scope }: { scope: "films" | "series" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onSlash = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onSlash);
    return () => document.removeEventListener("keydown", onSlash);
  }, []);

  useEffect(() => {
    if (!open) return;
    wrapRef.current?.querySelector("input")?.focus();
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

  return (
    <div className={styles.dropWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.ic}
        onClick={() => setOpen((o) => !o)}
        aria-label="Rechercher"
        aria-expanded={open}
        title="Rechercher ( / )"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
      </button>
      {open && (
        <div className={styles.searchPop}>
          <SearchBox scope={scope} />
        </div>
      )}
    </div>
  );
}
