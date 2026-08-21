import { prisma } from "@/lib/db";
import { getFilmCards } from "@/lib/films";
import { getSeriesCards } from "@/lib/series";

export type CommonTitle = {
  tmdbId: number;
  title: string;
  posterUrl: string;
  year: string;
  mine: number;
  theirs: number;
};

export type CompareResult = {
  common: CommonTitle[];
  /** Nombre de titres notés par chacun, toutes catégories confondues. */
  myTotal: number;
  theirTotal: number;
  myAverage: number | null;
  theirAverage: number | null;
  /** Score d'affinité 0–100. `null` s'il n'y a rien en commun. */
  affinity: number | null;
  /** Écart moyen en valeur absolue, sur 10. */
  meanGap: number;
  /** Titres notés exactement pareil par les deux. */
  exactMatches: number;
};

/**
 * Affinité de goûts, sur 100.
 *
 * On part de l'écart moyen entre les deux notes, rapporté à l'écart maximal
 * possible (9 points sur une échelle de 1 à 10). Deux personnes qui notent
 * identiquement obtiennent 100 ; deux personnes systématiquement aux extrêmes
 * opposés, 0.
 *
 * Volontairement plus lisible qu'une corrélation de Pearson, qui sur une
 * poignée de titres communs produit des valeurs instables — et un score
 * négatif, impossible à présenter simplement.
 */
function affinityScore(meanGap: number): number {
  return Math.max(0, Math.round((1 - meanGap / 9) * 100));
}

function summarise(
  pairs: Array<{ tmdbId: number; mine: number; theirs: number }>,
): Pick<CompareResult, "affinity" | "meanGap" | "exactMatches"> {
  if (pairs.length === 0) return { affinity: null, meanGap: 0, exactMatches: 0 };

  const totalGap = pairs.reduce((s, p) => s + Math.abs(p.mine - p.theirs), 0);
  const meanGap = totalGap / pairs.length;

  return {
    affinity: affinityScore(meanGap),
    meanGap: Math.round(meanGap * 10) / 10,
    exactMatches: pairs.filter((p) => p.mine === p.theirs).length,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/** Compare les films notés par deux utilisateurs. */
export async function compareFilms(
  myUserId: string,
  theirUserId: string,
): Promise<CompareResult> {
  const [mine, theirs] = await Promise.all([
    prisma.userFilm.findMany({
      where: { userId: myUserId, rating: { not: null } },
      select: { tmdbId: true, rating: true },
    }),
    prisma.userFilm.findMany({
      where: { userId: theirUserId, rating: { not: null } },
      select: { tmdbId: true, rating: true },
    }),
  ]);

  const theirsById = new Map(theirs.map((t) => [t.tmdbId, t.rating!]));
  const pairs = mine
    .filter((m) => theirsById.has(m.tmdbId))
    .map((m) => ({ tmdbId: m.tmdbId, mine: m.rating!, theirs: theirsById.get(m.tmdbId)! }));

  const cards = await getFilmCards(pairs.map((p) => p.tmdbId));

  const common: CommonTitle[] = pairs
    .map((p) => {
      const card = cards.get(p.tmdbId);
      if (!card) return null;
      return {
        tmdbId: p.tmdbId,
        title: card.title,
        posterUrl: card.posterUrl,
        year: card.year,
        mine: p.mine,
        theirs: p.theirs,
      };
    })
    .filter((x): x is CommonTitle => x !== null);

  return {
    common,
    myTotal: mine.length,
    theirTotal: theirs.length,
    myAverage: average(mine.map((m) => m.rating!)),
    theirAverage: average(theirs.map((t) => t.rating!)),
    ...summarise(pairs),
  };
}

/** Équivalent séries de `compareFilms`. */
export async function compareSeries(
  myUserId: string,
  theirUserId: string,
): Promise<CompareResult> {
  const [mine, theirs] = await Promise.all([
    prisma.userSeries.findMany({
      where: { userId: myUserId, rating: { not: null } },
      select: { tmdbId: true, rating: true },
    }),
    prisma.userSeries.findMany({
      where: { userId: theirUserId, rating: { not: null } },
      select: { tmdbId: true, rating: true },
    }),
  ]);

  const theirsById = new Map(theirs.map((t) => [t.tmdbId, t.rating!]));
  const pairs = mine
    .filter((m) => theirsById.has(m.tmdbId))
    .map((m) => ({ tmdbId: m.tmdbId, mine: m.rating!, theirs: theirsById.get(m.tmdbId)! }));

  const cards = await getSeriesCards(pairs.map((p) => p.tmdbId));

  const common: CommonTitle[] = pairs
    .map((p) => {
      const card = cards.get(p.tmdbId);
      if (!card) return null;
      return {
        tmdbId: p.tmdbId,
        title: card.name,
        posterUrl: card.posterUrl,
        year: card.year,
        mine: p.mine,
        theirs: p.theirs,
      };
    })
    .filter((x): x is CommonTitle => x !== null);

  return {
    common,
    myTotal: mine.length,
    theirTotal: theirs.length,
    myAverage: average(mine.map((m) => m.rating!)),
    theirAverage: average(theirs.map((t) => t.rating!)),
    ...summarise(pairs),
  };
}
