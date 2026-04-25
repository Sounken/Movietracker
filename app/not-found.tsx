import Link from "next/link";
import Image from "next/image";
import styles from "./not-found.module.css";

export default function NotFound() {
  const holes = Array.from({ length: 60 });

  return (
    <div className={styles.page}>
      <div className={styles.strip}>
        <div className={styles.stripHoles}>
          {holes.map((_, i) => <div key={i} className={styles.stripHole} />)}
        </div>
      </div>
      <div className={styles.stripBottom} />

      <div className={styles.ambient}>
        <div className={styles.ambCircle} />
        <div className={styles.ambCircle} />
        <div className={styles.ambCircle} />
      </div>
      <div className={styles.scanlines} />

      <div className={styles.center}>
        <Link href="/" className={styles.logo}>
          <Image src="/logo.png" alt="Movietracker" width={32} height={29} />
          <div className={styles.logoName}>Movie<em>tracker</em></div>
        </Link>

        <div className={styles.big404}>
          <span className={styles.num}>404</span>
          <span className={styles.numFill}>404</span>
        </div>

        <div className={styles.filmFrame}>
          <div className={styles.frameInner}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18M3 15h18M8 4v16M16 4v16" />
            </svg>
          </div>
          <div className={styles.frameLabel}>SCENE NOT FOUND · TAKE ∞</div>
        </div>

        <div className={styles.errorCode}>ERR · 404 · FRAME MISSING</div>

        <h1 className={styles.headline}>Cette scène <em>n&apos;existe pas.</em></h1>
        <p className={styles.subline}>
          La page que tu cherches a été coupée au montage, ou n&apos;a jamais tourné. Peut-être un mauvais lien ?
        </p>

        <div className={styles.actions}>
          <Link href="/" className={styles.btnHome}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />
            </svg>
            Retour à l&apos;accueil
          </Link>
          <Link href="/profile" className={styles.btnGhost}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            Mon profil
          </Link>
        </div>

        <div className={styles.suggestions}>
          <Link href="/" className={styles.sugPill}><span className={styles.sugDot} />Accueil</Link>
          <Link href="/lists" className={styles.sugPill}><span className={styles.sugDot} />Mes listes</Link>
          <Link href="/profile" className={styles.sugPill}><span className={styles.sugDot} />Profil</Link>
        </div>
      </div>

      <div className={styles.bottomInfo}>MOVIETRACKER · 2026 · PAGE INTROUVABLE</div>
    </div>
  );
}
