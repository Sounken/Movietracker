"use client";

import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import styles from "./import.module.css";

type Step = "idle" | "analyzing" | "ready" | "importing" | "done" | "error";

type Preview = {
  films: number;
  rated: number;
  reviews: number;
  watchlist: number;
  liked: number;
};

function countRows(csv: string): number {
  // Count non-empty lines after header
  return csv.split("\n").slice(1).filter((l) => l.trim()).length;
}

function countUnique(csvs: string[]): number {
  const keys = new Set<string>();
  for (const csv of csvs) {
    const lines = csv.split("\n").slice(1);
    for (const line of lines) {
      if (!line.trim()) continue;
      // Name is always 2nd column (after Date), Year is 3rd — rough parse for preview
      const parts = line.match(/^[^,]*,"?([^",]+)"?,(\d{4})/);
      if (parts) keys.add(`${parts[1].toLowerCase()}:${parts[2]}`);
      else {
        // Try simple split
        const cols = line.split(",");
        if (cols[1] && cols[2]) keys.add(`${cols[1].toLowerCase()}:${cols[2]}`);
      }
    }
  }
  return keys.size;
}

export default function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<Step>("idle");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const analyze = useCallback(async (f: File) => {
    setStep("analyzing");
    setFile(f);
    try {
      const buf = await f.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);

      async function read(path: string) {
        const entry = zip.file(path);
        return entry ? await entry.async("string") : "";
      }

      const [watched, ratings, reviews, watchlist, liked] = await Promise.all([
        read("watched.csv"),
        read("ratings.csv"),
        read("reviews.csv"),
        read("watchlist.csv"),
        read("likes/films.csv"),
      ]);

      const films = countUnique([watched, ratings, reviews, watchlist, liked]);

      setPreview({
        films,
        rated: countRows(ratings),
        reviews: countRows(reviews),
        watchlist: countRows(watchlist),
        liked: countRows(liked),
      });
      setStep("ready");
    } catch {
      setErrorMsg("Impossible de lire ce fichier ZIP. Vérifie qu'il vient bien de Letterboxd.");
      setStep("error");
    }
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      if (!f.name.endsWith(".zip")) {
        setErrorMsg("Le fichier doit être un .zip exporté depuis Letterboxd.");
        setStep("error");
        return;
      }
      analyze(f);
    },
    [analyze]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  async function handleImport() {
    if (!file) return;
    setStep("importing");
    setProgress(0);

    // Fake progress — real import time estimated based on film count
    const estimated = (preview?.films ?? 50) * 350; // ~350ms per film
    const tick = 200;
    progressRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + (tick / estimated) * 90, 90));
    }, tick);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/letterboxd", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(100);
      setResult(data);
      setStep("done");
    } catch (e) {
      if (progressRef.current) clearInterval(progressRef.current);
      setErrorMsg(e instanceof Error ? e.message : "Erreur lors de l'import.");
      setStep("error");
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* ——— Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.lbBadge}>
              <LetterboxdIcon />
            </div>
            <div>
              <div className={styles.title}>Importer depuis Letterboxd</div>
              <div className={styles.subtitle}>Exporte tes données sur letterboxd.com → Settings → Import &amp; Export</div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <XIcon />
          </button>
        </div>

        {/* ——— STEP: idle */}
        {(step === "idle" || step === "analyzing") && (
          <div
            className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ""} ${step === "analyzing" ? styles.dropzoneLoading : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {step === "analyzing" ? (
              <>
                <div className={styles.spinner} />
                <div className={styles.dropLabel}>Analyse en cours…</div>
              </>
            ) : (
              <>
                <div className={styles.dropIcon}>
                  <UploadIcon />
                </div>
                <div className={styles.dropLabel}>Glisse ton export Letterboxd ici</div>
                <div className={styles.dropSub}>ou clique pour choisir le fichier .zip</div>
              </>
            )}
          </div>
        )}

        {/* ——— STEP: ready */}
        {step === "ready" && preview && (
          <div className={styles.readySection}>
            <div className={styles.previewGrid}>
              <PreviewStat icon="🎬" label="Films" value={preview.films} accent />
              <PreviewStat icon="⭐" label="Notés" value={preview.rated} />
              <PreviewStat icon="✍️" label="Reviews" value={preview.reviews} />
              <PreviewStat icon="❤️" label="Likés" value={preview.liked} />
              <PreviewStat icon="📋" label="Watchlist" value={preview.watchlist} />
            </div>
            <p className={styles.readyNote}>
              Les films déjà présents dans ta collection seront mis à jour. Les données existantes ne seront pas effacées.
            </p>
            <button className={styles.importBtn} onClick={handleImport}>
              Importer {preview.films} films →
            </button>
          </div>
        )}

        {/* ——— STEP: importing */}
        {step === "importing" && (
          <div className={styles.importingSection}>
            <div className={styles.progressWrap}>
              <div className={styles.progressBar} style={{ width: `${progress}%` }} />
            </div>
            <div className={styles.importingLabel}>
              Recherche des films sur TMDB et import en cours…
            </div>
            <div className={styles.importingNote}>
              Ça peut prendre {preview ? Math.ceil((preview.films * 0.35) / 10) * 10 : 30}–{preview ? Math.ceil((preview.films * 0.5) / 10) * 10 : 60} secondes selon la taille de ta bibliothèque.
            </div>
          </div>
        )}

        {/* ——— STEP: done */}
        {step === "done" && result && (
          <div className={styles.doneSection}>
            <div className={styles.doneIcon}>✓</div>
            <div className={styles.doneTitle}>{result.imported} films importés !</div>
            {result.skipped > 0 && (
              <div className={styles.doneNote}>
                {result.skipped} film{result.skipped > 1 ? "s" : ""} non trouvé{result.skipped > 1 ? "s" : ""} sur TMDB (titres alternatifs ou non référencés).
              </div>
            )}
            <button className={styles.importBtn} onClick={() => { onDone(); onClose(); }}>
              Voir ma collection →
            </button>
          </div>
        )}

        {/* ——— STEP: error */}
        {step === "error" && (
          <div className={styles.errorSection}>
            <div className={styles.errorIcon}>✕</div>
            <div className={styles.errorMsg}>{errorMsg}</div>
            <button className={styles.retryBtn} onClick={() => { setStep("idle"); setErrorMsg(""); }}>
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewStat({ icon, label, value, accent }: { icon: string; label: string; value: number; accent?: boolean }) {
  return (
    <div className={`${styles.previewStat} ${accent ? styles.previewStatAccent : ""}`}>
      <div className={styles.previewStatIcon}>{icon}</div>
      <div className={styles.previewStatVal}>{value}</div>
      <div className={styles.previewStatLabel}>{label}</div>
    </div>
  );
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const LetterboxdIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <circle cx="8" cy="12" r="4" opacity="0.9" />
    <circle cx="16" cy="12" r="4" opacity="0.9" />
    <circle cx="12" cy="12" r="4" opacity="0.6" />
  </svg>
);
