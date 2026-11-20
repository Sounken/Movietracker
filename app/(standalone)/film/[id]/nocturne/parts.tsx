import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { Rating } from "@/lib/rating-scale";
import { CRITERIA, GROUPS, LEVELS, PRESETS, computeAssistant, type AssistantState, type CriterionGroup } from "@/lib/rating-assistant";
import { NotesButton } from "./FilmNocturneClient";
import styles from "./film-nocturne.module.css";

/** Briques serveur des fiches Nocturne, partagées entre films et séries. */

export type Crew = { id: number; name: string };

export function CrewLinks({ people }: { people: Crew[] }) {
  return (
    <>
      {people.map((d, i) => (
        <span key={d.id}>
          {i > 0 && ", "}
          <Link href={`/actor/${d.id}`} className={styles.crewLink}>{d.name}</Link>
        </span>
      ))}
    </>
  );
}

type RailItem = { id: number; title: string; posterUrl: string; year: string; voteAverage: number };

export function PosterRail({ title, items, hrefBase }: { title: string; items: RailItem[]; hrefBase: "/film" | "/series" }) {
  return (
    <div className={styles.railBlock}>
      <h2 className={styles.h3}>{title}</h2>
      <div className={styles.rail}>
        {items.slice(0, 20).map((s) => (
          <Link key={s.id} href={`${hrefBase}/${s.id}`} className={styles.railCard}>
            <span className={styles.railPoster}>
              {s.posterUrl && <Image src={s.posterUrl} alt="" fill sizes="150px" style={{ objectFit: "cover" }} />}
              {s.voteAverage > 0 && (
                <span className={styles.railNote}>★ <Rating value={s.voteAverage} /></span>
              )}
            </span>
            <span className={styles.railTitle}>{s.title}</span>
            <span className={styles.railYear}>{s.year}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
/** Colonne d'une note sur 10 (arrondie au point supérieur : 7.5 → 8). */
const bucket = (r: number) => Math.min(10, Math.max(1, Math.ceil(r)));

/**
 * « Les notes » : moyennes TMDB / amis / membres, et la répartition des notes
 * des membres.
 *
 * TMDB ne publie pas la répartition de ses votes, seulement une moyenne et un
 * nombre de votes ; les seules notes individuelles qu'il expose sont celles
 * des auteurs d'avis écrits — trois ou quatre par film, trop peu pour un
 * graphique. La moyenne TMDB y figure donc comme un repère, pas comme des
 * barres.
 */
export function RatingsCard({
  tmdbAvg,
  tmdbCount,
  friendsAvg,
  communityRatings,
}: {
  tmdbAvg: number;
  tmdbCount: number;
  friendsAvg: number | null;
  communityRatings: number[];
}) {
  const ours = Array.from({ length: 10 }, (_, i) => communityRatings.filter((r) => bucket(r) === i + 1).length);
  const max = Math.max(1, ...ours);

  return (
    <div className={`${styles.card} ${styles.notes}`}>
      <h2 className={styles.h3}>Les notes</h2>
      <div className={styles.noteTiles}>
        <div className={styles.noteTile}>
          <div className={`${styles.noteVal} ${styles.gold}`}><span className={styles.noteStar}>★</span> <Rating value={tmdbAvg || null} /></div>
          <div className={styles.noteLab}>TMDB • {tmdbCount.toLocaleString("fr-FR")} votes</div>
        </div>
        <div className={styles.noteTile}>
          <div className={styles.noteVal}><span className={styles.noteStar}>★</span> <Rating value={friendsAvg} /></div>
          <div className={styles.noteLab}>Tes amis</div>
        </div>
        <div className={styles.noteTile}>
          <div className={styles.noteVal}><span className={styles.noteStar}>★</span> <Rating value={avg(communityRatings)} /></div>
          <div className={styles.noteLab}>MovieTracker • {communityRatings.length}</div>
        </div>
      </div>
      {communityRatings.length > 0 && (
        <div className={styles.distWrap}>
          <div className={styles.distHead}>
            <span className={styles.distLab}>Répartition des notes MovieTracker</span>
            {tmdbAvg > 0 && (
              <span className={styles.distLegend}>
                <span><i className={styles.dotAvg} /> Moyenne TMDB</span>
              </span>
            )}
          </div>
          <div className={styles.dist}>
            {ours.map((n, i) => (
              <span key={i} className={styles.distCol} title={`${i + 1} : ${n} note${n > 1 ? "s" : ""}`}>
                <span className={styles.distOurs} style={{ height: `${(n / max) * 100}%` }} />
              </span>
            ))}
            {tmdbAvg > 0 && (
              <span className={styles.distAvg} style={{ left: `${((tmdbAvg - 0.5) / 10) * 100}%` }} aria-hidden="true" />
            )}
          </div>
          <div className={styles.distAxis}><span>1</span><span>5</span><span>10</span></div>
        </div>
      )}
    </div>
  );
}

/**
 * « Notes » : le détail enregistré avec « M'aider à noter » — niveau de chaque
 * critère, moyennes de l'œuvre et de l'expérience, bonus / malus — ou, à
 * défaut, l'invitation à le remplir.
 */
export function DetailCard({ detail }: { detail: { state: AssistantState; score: number } | null }) {
  const result = detail ? computeAssistant(detail.state) : null;
  const picked = (kind: "malus" | "bonus") =>
    detail ? PRESETS[kind].filter((p) => detail.state[kind].includes(p.id)).map((p) => p.label) : [];
  const malus = picked("malus");
  const bonus = picked("bonus");

  return (
    <div className={`${styles.card} ${styles.grille}`}>
      <div className={styles.grilleHead}>
        <div>
          <div className={styles.eyebrow}>Notes</div>
          <h2 className={styles.h3}>
            {detail ? "Ta note détaillée" : "Tu l'as vu ? Note-le en 30 secondes."}
          </h2>
        </div>
        {detail ? (
          <div className={styles.detailScore}>
            <span className={styles.detailVal}><Rating value={detail.score} /></span>
            <NotesButton className={styles.lineBtnSm}>Modifier</NotesButton>
          </div>
        ) : (
          <NotesButton className={styles.assistBtn}>
            <Sparkles size={14} /> M&apos;aider à noter
          </NotesButton>
        )}
      </div>
      <div className={styles.grilleCols}>
        {(Object.keys(GROUPS) as CriterionGroup[]).map((g) => (
          <div key={g} className={styles.grilleCol}>
            <div className={styles.grilleColHead}>
              <span>{GROUPS[g].label}</span>
              <span className={styles.mono}>
                {result ? (g === "head" ? result.head : result.heart).toFixed(1) : `${Math.round(GROUPS[g].weight * 100)} %`}
              </span>
            </div>
            {CRITERIA.filter((c) => c.group === g).map((c) => {
              const value = detail?.state.levels[c.id];
              const level = LEVELS.find((l) => l.value === value);
              return (
                <div key={c.id} className={styles.crit}>
                  <span>{c.label}</span>
                  <span className={styles.levels} title={level?.label}>
                    {LEVELS.map((l) => (
                      <i
                        key={l.value}
                        style={
                          l.value === value
                            ? { borderColor: l.color, background: l.color }
                            : { borderColor: `${l.color}66`, background: `${l.color}1f` }
                        }
                      />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {detail && (malus.length > 0 || bonus.length > 0 || detail.state.customBonus > 0 || detail.state.customMalus > 0) ? (
        <div className={styles.adjusts}>
          {bonus.map((b) => <span key={b} className={styles.bonus}>+ {b}</span>)}
          {detail.state.customBonus > 0 && <span className={styles.bonus}>+ Autre bonus ({detail.state.customBonus.toFixed(1)})</span>}
          {malus.map((m) => <span key={m} className={styles.malus}>− {m}</span>)}
          {detail.state.customMalus > 0 && <span className={styles.malus}>− Autre malus ({detail.state.customMalus.toFixed(1)})</span>}
        </div>
      ) : (
        !detail && <div className={styles.grilleFoot}>5 niveaux par critère, puis bonus et malus en un clic.</div>
      )}
    </div>
  );
}
