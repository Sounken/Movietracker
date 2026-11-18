import "server-only";
import { tmdbFetch } from "@/lib/tmdb-throttle";

/**
 * Date de sortie d'un film **en France**, pour le calendrier et « me prévenir ».
 *
 * `release_date` de /movie/{id} est la date de sortie d'origine : un film
 * américain y figure à sa date américaine, souvent des semaines avant la
 * France. On lit donc /movie/{id}/release_dates, région FR :
 *   - type 3 : sortie nationale en salles ;
 *   - type 4 : sortie numérique (plateformes, VOD) — pour les films qui ne
 *     passent pas par la salle.
 * Les types 1 (avant-première, festival) et 2 (sortie limitée) sont ignorés :
 * personne ne veut être prévenu d'une projection à Cannes.
 *
 * Sans aucune date française, on retombe sur la première sortie en salles
 * mondiale, signalée comme telle (`france: false`).
 */
export type FilmRelease = {
  date: string;
  kind: "cinema" | "digital";
  /** Faux quand la date n'est pas française (repli sur la sortie mondiale). */
  france: boolean;
};

type ReleaseDate = { release_date: string; type: number };
type CountryReleases = { iso_3166_1: string; release_dates: ReleaseDate[] };

const earliest = (dates: ReleaseDate[], type: number) =>
  dates
    .filter((d) => d.type === type && d.release_date)
    .map((d) => d.release_date.slice(0, 10))
    .sort()[0] ?? null;

export async function fetchFilmRelease(tmdbId: number): Promise<FilmRelease | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const res = await tmdbFetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/release_dates?api_key=${key}`,
      // Les dates françaises bougent rarement plus d'une fois par jour.
      { next: { revalidate: 21600 } },
    );
    if (!res.ok) return null;
    const results = ((await res.json()).results ?? []) as CountryReleases[];

    const fr = results.find((c) => c.iso_3166_1 === "FR")?.release_dates ?? [];
    const cinema = earliest(fr, 3);
    if (cinema) return { date: cinema, kind: "cinema", france: true };
    const digital = earliest(fr, 4);
    if (digital) return { date: digital, kind: "digital", france: true };

    const world = earliest(results.flatMap((c) => c.release_dates), 3);
    return world ? { date: world, kind: "cinema", france: false } : null;
  } catch {
    return null;
  }
}

/** Date du jour à Paris, au format AAAA-MM-JJ (les sorties sont des jours français). */
export function parisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

/** Décale une date AAAA-MM-JJ de `days` jours. */
export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
