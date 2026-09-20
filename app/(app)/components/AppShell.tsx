import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Sidebar from "./Sidebar";
import styles from "../app.module.css";
import { computeXP, getLevelInfo } from "@/lib/xp";
import { RatingScaleProvider } from "@/lib/rating-scale";
import { toRatingScale } from "@/lib/rating";

/**
 * Cadre de l'application : barre latérale + zone de contenu.
 *
 * Extrait du layout du groupe `(app)` pour que les fiches film, série, acteur
 * et société — qui vivent dans `(standalone)` — en bénéficient aussi. Elles
 * s'affichaient jusqu'ici sans navigation : ouvrir un film depuis Découvrir
 * faisait disparaître Bibliothèque et Social, et il fallait revenir en arrière
 * pour les retrouver.
 *
 * `flush` retire le gabarit de la zone de contenu (marges, largeur maximale) :
 * les fiches gèrent leur propre mise en page, affiche en fond comprise, et ne
 * doivent pas être contraintes comme une page de liste.
 */
export default async function AppShell({
  children,
  flush = false,
}: {
  children: React.ReactNode;
  flush?: boolean;
}) {
  const session = await getSession();

  const [
    watchlist, liked, filmEntries,
    sWatchlist, sLiked, seriesEntries,
    user,
  ] = session
    ? await Promise.all([
        prisma.userFilm.count({ where: { userId: session.userId, watchlist: true } }),
        prisma.userFilm.count({ where: { userId: session.userId, liked: true } }),
        prisma.userFilm.findMany({
          where: { userId: session.userId },
          select: { rating: true, review: true, liked: true, watched: true },
        }),
        prisma.userSeries.count({ where: { userId: session.userId, watchlist: true } }),
        prisma.userSeries.count({ where: { userId: session.userId, liked: true } }),
        prisma.userSeries.findMany({
          where: { userId: session.userId },
          select: { rating: true, review: true, liked: true, watched: true },
        }),
        prisma.user.findUnique({
          where: { id: session.userId },
          select: { avatarUrl: true, ratingScale: true },
        }),
      ])
    : [0, 0, [], 0, 0, [], null];

  type XpEntry = { rating: number | null; review: string | null; liked: boolean; watched: boolean };
  const filmLevel = getLevelInfo(computeXP(filmEntries as XpEntry[]));
  const seriesLevel = getLevelInfo(computeXP(seriesEntries as XpEntry[]));

  return (
    <RatingScaleProvider scale={toRatingScale(user?.ratingScale)}>
      <div className={flush ? `${styles.app} ${styles.appFlush}` : styles.app}>
        <Sidebar
          isAuthenticated={!!session}
          userName={session?.name ?? null}
          avatarUrl={user?.avatarUrl ?? null}
          counts={{ watchlist: watchlist as number, liked: liked as number }}
          seriesCounts={{ watchlist: sWatchlist as number, liked: sLiked as number }}
          levelInfo={filmLevel}
          seriesLevel={seriesLevel}
        />
        <main className={flush ? styles.mainFlush : styles.main}>{children}</main>
      </div>
    </RatingScaleProvider>
  );
}
