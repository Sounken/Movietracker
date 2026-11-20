"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import StarRating from "@/app/(app)/components/StarRating";
import { Rating, useRatingScale } from "@/lib/rating-scale";
import { formatRating } from "@/lib/rating";
import type { ReviewCard } from "@/lib/reviews";
import { saveRating, deleteRating, toggleWatchlist, toggleLiked } from "@/app/actions/film";
import { toggleSeriesWatchlist, toggleSeriesLiked } from "@/app/actions/series";
import { addFilmToList, removeFilmFromList } from "@/app/actions/lists";
import { logFilmWatch } from "@/app/actions/journal";
import { saveRatingDetail } from "@/app/actions/rating-detail";
import type { AssistantState } from "@/lib/rating-assistant";
import RatingAssistant from "./RatingAssistant";
import styles from "./sheet.module.css";

/** La carte « Notes » du contenu ouvre l'assistant de la colonne. */
const OPEN_NOTES = "sheet:open-notes";

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BackButton({ className, fallbackHref = "/films" }: { className?: string; fallbackHref?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
      Retour
    </button>
  );
}

const Icon = ({ d, fill = "none" }: { d: string; fill?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const HEART = "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z";
const LIST = "M8 6h13M8 12h13M8 18h7M3 6h.01M3 12h.01M3 18h.01M18 15v6M15 18h6";
const SHARE = "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13";

/**
 * Actions du hero : bande-annonce, À voir, Vu, J'aime, liste, partager.
 * Mêmes Server Actions que le Journal et les listes.
 */
export function HeroActions({
  kind = "film",
  tmdbId,
  title,
  hasTrailer,
  initialWatchlist,
  initialLiked,
  watched = false,
  isAuthenticated,
  userLists = [],
  listsWithFilm = [],
}: {
  /** Séries : ni « Vu » (le suivi se fait par épisode) ni listes. */
  kind?: "film" | "series";
  tmdbId: number;
  title: string;
  hasTrailer: boolean;
  initialWatchlist: boolean;
  initialLiked: boolean;
  watched?: boolean;
  isAuthenticated: boolean;
  userLists?: { id: string; name: string; emoji: string }[];
  listsWithFilm?: string[];
}) {
  const isFilm = kind === "film";
  const router = useRouter();
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [liked, setLiked] = useState(initialLiked);
  const [lists, setLists] = useState(() => new Set(listsWithFilm));
  const [listOpen, setListOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listOpen) return;
    const onPointer = (e: MouseEvent) => !listRef.current?.contains(e.target as Node) && setListOpen(false);
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [listOpen]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  /** Visiteur non connecté : toute action mène à la connexion. */
  const requireAuth = () => {
    if (!isAuthenticated) router.push("/login");
    return isAuthenticated;
  };

  const markWatched = () => {
    if (!requireAuth()) return;
    // Déjà vu : la date et les revisionnages se gèrent dans le Journal
    if (watched) return router.push("/films/journal");
    startTransition(async () => {
      await logFilmWatch(tmdbId, localToday());
      router.refresh();
    });
  };

  const share = async () => {
    const url = `${window.location.origin}/${isFilm ? "film" : "series"}/${tmdbId}`;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const toggleList = (id: string) => {
    if (!requireAuth()) return;
    const isIn = lists.has(id);
    setLists((prev) => {
      const next = new Set(prev);
      if (isIn) next.delete(id);
      else next.add(id);
      return next;
    });
    startTransition(async () => {
      if (isIn) await removeFilmFromList(id, tmdbId);
      else await addFilmToList(id, tmdbId);
    });
  };

  return (
    <div className={styles.actions}>
      {hasTrailer && (
        <button className={`${styles.btn} ${styles.btnP}`} onClick={() => scrollTo("bande-annonce")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg>
          Bande-annonce
        </button>
      )}
      <button
        className={`${styles.btn} ${watchlist ? styles.btnOn : styles.btnS}`}
        onClick={() =>
          requireAuth() &&
          startTransition(async () => {
            setWatchlist((v) => !v);
            await (isFilm ? toggleWatchlist : toggleSeriesWatchlist)(tmdbId);
          })
        }
      >
        {watchlist ? <><Check size={15} /> À voir</> : "+ À voir"}
      </button>
      {isFilm && (
        <button className={`${styles.btn} ${watched ? styles.btnOn : styles.btnS}`} onClick={markWatched} disabled={pending}>
          {watched ? <><Check size={15} /> Vu</> : "Vu aujourd'hui"}
        </button>
      )}
      <button
        className={`${styles.ic} ${liked ? styles.icOn : ""}`}
        aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
        aria-pressed={liked}
        onClick={() =>
          requireAuth() &&
          startTransition(async () => {
            setLiked((v) => !v);
            await (isFilm ? toggleLiked : toggleSeriesLiked)(tmdbId);
          })
        }
      >
        <Icon d={HEART} fill={liked ? "currentColor" : "none"} />
      </button>
      {isFilm && (
      <div className={styles.listWrap} ref={listRef}>
        <button
          className={`${styles.ic} ${lists.size > 0 ? styles.icOn : ""}`}
          aria-label="Ajouter à une liste"
          aria-expanded={listOpen}
          onClick={() => requireAuth() && setListOpen((o) => !o)}
        >
          <Icon d={LIST} />
        </button>
        {listOpen && (
          <div className={styles.listMenu}>
            {userLists.length === 0 ? (
              <Link href="/films/lists" className={styles.listItem}>Créer une liste</Link>
            ) : (
              userLists.map((l) => (
                <button key={l.id} className={styles.listItem} onClick={() => toggleList(l.id)}>
                  <span>{l.emoji}</span>
                  <span className={styles.listName}>{l.name}</span>
                  {lists.has(l.id) && <Check size={14} />}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      )}
      <button className={styles.ic} aria-label="Partager" onClick={share} title={copied ? "Lien copié" : "Partager"}>
        {copied ? <Check size={18} /> : <Icon d={SHARE} />}
      </button>
    </div>
  );
}

/**
 * « Ma note » : la note aux étoiles (StarRating, comme la fiche actuelle),
 * affichée en grand, « M'aider à noter » et l'avis.
 */
export function MyRating({
  tmdbId,
  title,
  initialRating,
  initialReview,
  isAuthenticated,
  saveAction = saveRating,
  deleteAction = deleteRating,
  media = "movie",
  initialDetail = null,
}: {
  tmdbId: number;
  title: string;
  initialRating: number;
  initialReview: string;
  isAuthenticated: boolean;
  /** Server Actions injectées : la même carte sert aux films et aux séries. */
  saveAction?: (tmdbId: number, rating: number, review: string) => Promise<void>;
  deleteAction?: (tmdbId: number) => Promise<void>;
  media?: "movie" | "tv";
  /** Notes détaillées enregistrées : l'assistant rouvre avec ces réglages. */
  initialDetail?: AssistantState | null;
}) {
  const router = useRouter();
  const scale = useRatingScale();
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState<number | null>(null);
  const [review, setReview] = useState(initialReview);
  const [savedReview, setSavedReview] = useState(initialReview);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const open = () => (isAuthenticated ? setAssistantOpen(true) : router.push("/login"));
    window.addEventListener(OPEN_NOTES, open);
    return () => window.removeEventListener(OPEN_NOTES, open);
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (savedAt === null) return;
    const t = setTimeout(() => setSavedAt(null), 2400);
    return () => clearTimeout(t);
  }, [savedAt]);

  const rate = (value: number) => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setRating(value);
    startTransition(async () => {
      await saveAction(tmdbId, value, review);
      setSavedReview(review);
      setSavedAt(Date.now());
      router.refresh();
    });
  };

  const clear = () => {
    setRating(0);
    setReview("");
    setSavedReview("");
    startTransition(async () => {
      await deleteAction(tmdbId);
      router.refresh();
    });
  };

  const saveReview = () =>
    startTransition(async () => {
      await saveAction(tmdbId, rating, review);
      setSavedReview(review);
      router.refresh();
    });

  const shown = hover ?? rating;

  return (
    <div className={`${styles.card} ${styles.rating}`}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Ma note</span>
        {savedAt !== null ? (
          <span className={styles.saved}><Check size={13} /> Enregistrée</span>
        ) : (
          <span className={styles.mono}>sur {scale}</span>
        )}
      </div>

      <div className={styles.bigNote}>
        <span key={shown} className={`${styles.bigVal} ${shown > 0 ? styles.gold : ""}`}>
          {shown > 0 ? formatRating(shown, scale) : "—"}
        </span>
        {shown === 0 && <span className={styles.bigHint}>pas encore noté</span>}
      </div>

      <div className={styles.starsSlot}>
        <StarRating value={rating} onRate={rate} onClear={clear} onHoverChange={setHover} showValue={false} size={22} />
      </div>

      <button
        type="button"
        className={styles.assistBtn}
        onClick={() => (isAuthenticated ? setAssistantOpen(true) : router.push("/login"))}
        title="Se faire aider pour fixer la note"
      >
        <Sparkles size={14} /> M&apos;aider à noter
      </button>

      <div className={styles.twoBtns}>
        <button
          className={styles.lineBtn}
          onClick={() => setReviewOpen((o) => !o)}
          disabled={rating === 0}
          title={rating === 0 ? "Notez d'abord le film" : undefined}
        >
          {savedReview ? "Mon avis" : "Écrire une critique"}
        </button>
      </div>

      {reviewOpen && rating > 0 && (
        <div className={styles.reviewBox}>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder={`Qu'avez-vous pensé de « ${title} » ?`}
            className={styles.textarea}
          />
          <div className={styles.reviewActions}>
            <button className={styles.linkBtn} onClick={clear} disabled={pending}>Supprimer ma note</button>
            <button className={styles.smallBtn} onClick={saveReview} disabled={pending || review === savedReview}>
              {review === savedReview ? "Avis enregistré" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {assistantOpen && (
        <RatingAssistant
          scale={scale}
          title={title}
          initial={initialDetail}
          onClose={() => setAssistantOpen(false)}
          onApply={(value, state) => {
            setAssistantOpen(false);
            rate(value);
            // Le détail part à côté de la note : on peut ensuite retoucher la
            // note aux étoiles sans perdre les critères.
            startTransition(async () => {
              await saveRatingDetail(media, tmdbId, state);
              router.refresh();
            });
          }}
        />
      )}
    </div>
  );
}

export function NotesButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button className={className} onClick={() => window.dispatchEvent(new Event(OPEN_NOTES))}>
      {children}
    </button>
  );
}

/** Onglets collants : ils défilent jusqu'à leur section et suivent la lecture. */
export function SectionTabs({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav className={styles.tabs} aria-label="Sections">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`${styles.tab} ${active === s.id ? styles.tabOn : ""}`}
          onClick={(e) => {
            e.preventDefault();
            setActive(s.id);
            document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

/** Critiques : amis d'abord, communauté (TMDB) en second onglet. */
export function ReviewsBlock({ reviews }: { reviews: ReviewCard[] }) {
  const friends = reviews.filter((r) => r.source === "friend");
  const community = reviews.filter((r) => r.source === "tmdb");
  const [tab, setTab] = useState<"friend" | "tmdb">(friends.length > 0 ? "friend" : "tmdb");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const list = tab === "friend" ? friends : community;

  return (
    <>
      <div className={styles.blockHead}>
        <h2 className={styles.h2}>Critiques</h2>
        <div className={styles.miniTabs}>
          <button className={`${styles.tab} ${styles.tabSm} ${tab === "friend" ? styles.tabOn : ""}`} onClick={() => setTab("friend")}>
            Amis • {friends.length}
          </button>
          <button className={`${styles.tab} ${styles.tabSm} ${tab === "tmdb" ? styles.tabOn : ""}`} onClick={() => setTab("tmdb")}>
            Communauté • {community.length}
          </button>
        </div>
      </div>
      {list.length === 0 ? (
        <p className={styles.empty}>
          {tab === "friend" ? "Aucun de tes amis n'a encore donné son avis." : "Aucune critique de la communauté."}
        </p>
      ) : (
        <div className={styles.reviews}>
          {list.map((r) => {
            const long = r.content.length > 240;
            const expanded = open.has(r.id);
            return (
              <article key={r.id} className={`${styles.card} ${styles.review}`}>
                <div className={styles.reviewHead}>
                  <span className={styles.reviewAv}>
                    {r.avatarUrl ? <Image src={r.avatarUrl} alt="" width={40} height={40} /> : r.name.charAt(0).toUpperCase()}
                  </span>
                  <div className={styles.reviewWho}>
                    {r.href && r.source === "friend" ? <Link href={r.href}>{r.name}</Link> : <span>{r.name}</span>}
                    <span className={styles.mono}>{r.date}{r.source === "tmdb" ? " • TMDB, en anglais" : ""}</span>
                  </div>
                  {r.rating !== null && (
                    <span className={styles.reviewNote}>★ <Rating value={r.rating} /></span>
                  )}
                </div>
                {r.content ? (
                  <>
                    <p className={`${styles.reviewText} ${long && !expanded ? styles.clamp : ""}`}>{r.content}</p>
                    {long && (
                      <button
                        className={styles.linkBtn}
                        onClick={() =>
                          setOpen((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          })
                        }
                      >
                        {expanded ? "Réduire" : "Lire la suite"}
                      </button>
                    )}
                  </>
                ) : (
                  <p className={styles.reviewText}>A noté le film, sans écrire d&apos;avis.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
