import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { fetchPersonDetail, fetchPersonCredits, fetchPersonPopularRank } from "@/lib/tmdb";
import ActorTopbar from "./ActorTopbar";
import FilmographyClient from "./FilmographyClient";
import styles from "./actor.module.css";
import { Rating } from "@/lib/rating-scale";

function age(birthday: string, deathday: string | null): number | null {
  const end = deathday ? new Date(deathday) : new Date();
  const birth = new Date(birthday);
  const diff = end.getFullYear() - birth.getFullYear();
  const hadBirthday =
    end.getMonth() > birth.getMonth() ||
    (end.getMonth() === birth.getMonth() && end.getDate() >= birth.getDate());
  return hadBirthday ? diff : diff - 1;
}

const DEPT_LABELS: Record<string, string> = {
  Acting: "Acteur · Actrice",
  Directing: "Réalisateur·ice",
  Writing: "Scénariste",
  Production: "Producteur·ice",
  "Visual Effects": "Effets visuels",
  Camera: "Chef opérateur",
  Sound: "Son",
  Editing: "Monteur",
  Crew: "Équipe technique",
};

export default async function ActorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  const [person, credits, rank] = await Promise.all([
    fetchPersonDetail(id),
    fetchPersonCredits(id),
    fetchPersonPopularRank(id),
  ]);

  if (!person) notFound();

  const personAge = person.birthday ? age(person.birthday, person.deathday) : null;
  const top4 = credits.slice(0, 4);
  // La filmographie reprend TOUT, y compris les 4 films emblématiques : les
  // exclure donnait une liste incomplète, où les films les plus connus
  // manquaient à l'appel.
  const filmography = credits;
  const deptLabel = DEPT_LABELS[person.knownForDepartment] ?? person.knownForDepartment;

  // Sur la fiche d'un réalisateur ou d'un scénariste, on ouvre la filmographie
  // sur son métier plutôt que sur « Tout » : c'est ce qu'on vient y chercher.
  const DEFAULT_FILTER = {
    Directing: "directing",
    Writing: "writing",
    Production: "production",
    Acting: "acting",
  } as const;
  const defaultFilter =
    DEFAULT_FILTER[person.knownForDepartment as keyof typeof DEFAULT_FILTER] ?? "all";

  const backdropFilm = credits[0];

  return (
    <>
      {backdropFilm?.posterUrl && (
        <div className={styles.backdrop}>
          <Image
            src={backdropFilm.posterUrl}
            alt=""
            fill
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "center 20%" }}
          />
        </div>
      )}
      <div className={styles.backdropOverlay} />

      <ActorTopbar />

      <div className={styles.hero}>
        {/* Left column */}
        <div className={styles.posterCol}>
          {person.profileUrl ? (
            <Image src={person.profileUrl} alt={person.name} className={styles.photo} width={240} height={360} priority />
          ) : (
            <div className={styles.photoFallback}>
              {person.name[0]}
            </div>
          )}

          <div className={styles.sideStats}>
            {person.birthday && (
              <div className={styles.sideStat}>
                <div className={styles.sideStatLab}>Naissance</div>
                <div className={styles.sideStatVal}>
                  {new Date(person.birthday).toLocaleDateString("fr-FR")}
                  {personAge !== null && !person.deathday && (
                    <span className={styles.sideStatSub}> · {personAge} ans</span>
                  )}
                </div>
              </div>
            )}
            {person.deathday && (
              <div className={styles.sideStat}>
                <div className={styles.sideStatLab}>Décès</div>
                <div className={styles.sideStatVal}>
                  {new Date(person.deathday).toLocaleDateString("fr-FR")}
                  {personAge !== null && (
                    <span className={styles.sideStatSub}> · {personAge} ans</span>
                  )}
                </div>
              </div>
            )}
            {person.placeOfBirth && (
              <div className={styles.sideStat}>
                <div className={styles.sideStatLab}>Lieu de naissance</div>
                <div className={styles.sideStatVal}>{person.placeOfBirth}</div>
              </div>
            )}
            <div className={styles.sideStat}>
              <div className={styles.sideStatLab}>Films au crédit</div>
              <div className={styles.sideStatVal}>{credits.length}</div>
            </div>
            {rank !== null ? (
              <div className={styles.sideStat}>
                <div className={styles.sideStatLab}>Classement mondial</div>
                <div className={styles.sideStatVal}>#{rank}</div>
              </div>
            ) : null}

            {(person.imdbId || person.instagramId || person.twitterId) && (
              <div className={styles.sideStat}>
                <div className={styles.sideStatLab}>Liens</div>
                <div className={styles.socialLinks}>
                  {person.imdbId && (
                    <a
                      href={`https://www.imdb.com/name/${person.imdbId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialLink}
                    >
                      IMDb
                    </a>
                  )}
                  {person.instagramId && (
                    <a
                      href={`https://www.instagram.com/${person.instagramId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialLink}
                    >
                      Instagram
                    </a>
                  )}
                  {person.twitterId && (
                    <a
                      href={`https://x.com/${person.twitterId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialLink}
                    >
                      X / Twitter
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className={styles.metaCol}>
          <div className={styles.deptBadge}>{deptLabel}</div>
          <h1 className={styles.name}>{person.name}</h1>

          {person.biography && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Biographie</div>
              <div className={styles.bioText}>
                {person.biography.split("\n\n").filter(Boolean).map((para, i) => (
                  <p key={i} className={styles.bio}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {top4.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Films emblématiques</div>
              <div className={styles.top4Grid}>
                {top4.map((film) => (
                  <Link key={film.id} href={`/film/${film.id}`} className={styles.top4Card}>
                    <Image
                      src={film.posterUrl}
                      alt={film.title}
                      className={styles.top4Poster}
                      width={300}
                      height={450}
                      sizes="(max-width: 768px) 50vw, 220px"
                      // height:auto neutralise l'attribut height (sinon il écrase l'aspect-ratio CSS)
                      style={{ height: "auto" }}
                    />
                    <div className={styles.top4Info}>
                      <div className={styles.top4Title}>{film.title}</div>
                      <div className={styles.top4Meta}>
                        {film.year}
                        {film.character && <> · <span className={styles.top4Role}>{film.character}</span></>}
                      </div>
                      {film.voteAverage > 0 && (
                        <div className={styles.top4Score}>★ <Rating value={film.voteAverage} /></div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {filmography.length > 0 && <FilmographyClient credits={filmography} defaultFilter={defaultFilter} />}
        </div>
      </div>
    </>
  );
}
