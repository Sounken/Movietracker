import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { THRESHOLDS, TRACKED_METRICS, type TrackedMetric } from "@/lib/web-vitals-route";
import styles from "./vitals.module.css";

export const dynamic = "force-dynamic";

type Row = {
  route: string;
  metric: string;
  p75: number;
  samples: bigint;
};

type Verdict = "good" | "needs-improvement" | "poor";

/**
 * Performances perçues, par route.
 *
 * On agrège au 75e centile et non à la moyenne : c'est la convention des Core
 * Web Vitals, et pour une bonne raison — une moyenne masque la queue de
 * distribution, là où se trouvent précisément les visiteurs qui souffrent. Le
 * p75 dit « trois utilisateurs sur quatre ont au moins cette expérience ».
 *
 * `percentile_cont` n'a pas d'équivalent dans l'API Prisma, d'où la requête
 * brute.
 */
async function fetchVitals(days: number): Promise<Row[]> {
  return prisma.$queryRaw<Row[]>`
    SELECT
      route,
      metric,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75,
      COUNT(*) AS samples
    FROM "WebVital"
    WHERE "createdAt" > NOW() - (${days} || ' days')::interval
    GROUP BY route, metric
    HAVING COUNT(*) >= 3
    ORDER BY route, metric
  `;
}

/**
 * Ce que chaque sigle mesure, dit en français.
 *
 * Les cinq acronymes sont le vocabulaire de la spécification, pas celui de
 * quelqu'un qui veut savoir si son site est lent. Chaque métrique porte donc un
 * nom lisible et la question à laquelle elle répond ; le sigle reste affiché,
 * mais en second, pour rester raccord avec la documentation officielle.
 *
 * Défini ici plutôt que dans `lib/web-vitals-route.ts` : ce module est importé
 * par le collecteur côté navigateur, et ces libellés n'ont aucune raison de
 * peser dans le bundle client.
 */
const METRIC_INFO: Record<TrackedMetric, { label: string; question: string }> = {
  LCP: {
    label: "Affichage principal",
    question: "Temps avant que le contenu principal — l'affiche, le titre — devienne visible.",
  },
  INP: {
    label: "Réactivité",
    question: "Délai entre un clic et la réaction visible de la page.",
  },
  CLS: {
    label: "Stabilité",
    question: "À quel point le contenu saute pendant le chargement. C'est un score, pas une durée.",
  },
  TTFB: {
    label: "Réponse serveur",
    question: "Temps que met le serveur à commencer à répondre.",
  },
  FCP: {
    label: "Premier affichage",
    question: "Temps avant que le tout premier élément apparaisse à l'écran.",
  },
};

const VERDICT_LABEL: Record<Verdict, string> = {
  good: "Bon",
  "needs-improvement": "À surveiller",
  poor: "À corriger",
};

/** Ordre de gravité, pour trier et pour agréger le verdict d'une route. */
const SEVERITY: Record<Verdict, number> = { good: 0, "needs-improvement": 1, poor: 2 };

function verdict(metric: string, value: number): Verdict {
  const t = THRESHOLDS[metric as TrackedMetric];
  if (!t) return "needs-improvement";
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

/**
 * Durées en unité lisible plutôt qu'en millisecondes brutes.
 *
 * « 4230 ms » demande une conversion mentale à chaque lecture ; « 4,2 s » se
 * comprend d'un coup d'œil. On bascule à la seconde au-delà de 1000 ms, et on
 * garde la virgule décimale française.
 */
function format(metric: string, value: number): string {
  if (metric === "CLS") return value.toFixed(3).replace(".", ",");
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")} s`;
  return `${Math.round(value)} ms`;
}

export default async function VitalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await fetchVitals(7);

  const byRoute = new Map<string, Map<string, Row>>();
  for (const row of rows) {
    if (!byRoute.has(row.route)) byRoute.set(row.route, new Map());
    byRoute.get(row.route)!.set(row.metric, row);
  }

  /**
   * Chaque route reçoit le verdict de sa pire métrique : une page dont
   * l'affichage principal est bon mais qui saute dans tous les sens n'est pas
   * une page saine, et la moyenne des verdicts l'aurait laissé croire.
   *
   * Le tri place ensuite les routes les plus dégradées en tête. C'est le seul
   * changement qui transforme le tableau en liste de tâches : trié par ordre
   * alphabétique, ce qui demande une correction pouvait se trouver n'importe où.
   */
  const routes = [...byRoute.entries()]
    .map(([route, metrics]) => {
      const cells = [...metrics.values()];
      const worst = cells.reduce<Verdict>(
        (acc, cell) => (SEVERITY[verdict(cell.metric, cell.p75)] > SEVERITY[acc] ? verdict(cell.metric, cell.p75) : acc),
        "good",
      );
      const samples = Math.max(...cells.map((c) => Number(c.samples)));
      const poids = cells.reduce((n, c) => n + SEVERITY[verdict(c.metric, c.p75)], 0);
      return { route, metrics, worst, samples, poids };
    })
    .sort((a, b) => SEVERITY[b.worst] - SEVERITY[a.worst] || b.poids - a.poids || a.route.localeCompare(b.route));

  const aCorriger = routes.filter((r) => r.worst === "poor").length;
  const aSurveiller = routes.filter((r) => r.worst === "needs-improvement").length;

  /**
   * La mesure la plus dégradée, exprimée en une phrase. C'est la réponse à
   * « par quoi je commence ? », que le tableau seul ne donnait pas : il fallait
   * comparer chaque cellule à un seuil rappelé en tout petit dans l'en-tête.
   */
  const pire = rows
    .map((r) => ({ ...r, v: verdict(r.metric, r.p75), ratio: r.p75 / THRESHOLDS[r.metric as TrackedMetric].good }))
    .filter((r) => r.v === "poor")
    .sort((a, b) => b.ratio - a.ratio)[0];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Performances perçues</h1>
      <p className={styles.intro}>
        Ce que vivent réellement les visiteurs, mesuré dans leur navigateur sur les
        sept derniers jours. Chaque valeur est un 75<sup>e</sup> centile : trois
        visiteurs sur quatre ont eu au moins cette expérience. Les routes comptant
        moins de trois relevés sont masquées.
      </p>

      {rows.length === 0 ? (
        <p className={styles.empty}>
          Aucune mesure pour l&apos;instant. Les relevés arrivent au fil des
          visites — comptez quelques minutes après un déploiement.
        </p>
      ) : (
        <>
          <section className={styles.summary}>
            <div className={styles.summaryFigures}>
              <div className={styles.figure}>
                <span className={styles.figureValue}>{routes.length}</span>
                <span className={styles.figureLabel}>routes mesurées</span>
              </div>
              <div className={`${styles.figure} ${aCorriger > 0 ? styles.figurePoor : ""}`}>
                <span className={styles.figureValue}>{aCorriger}</span>
                <span className={styles.figureLabel}>à corriger</span>
              </div>
              <div className={`${styles.figure} ${aSurveiller > 0 ? styles.figureWatch : ""}`}>
                <span className={styles.figureValue}>{aSurveiller}</span>
                <span className={styles.figureLabel}>à surveiller</span>
              </div>
            </div>

            <p className={styles.headline}>
              {pire ? (
                <>
                  <strong>Par quoi commencer :</strong> sur{" "}
                  <code className={styles.inlineRoute}>{pire.route}</code>,{" "}
                  {METRIC_INFO[pire.metric as TrackedMetric].label.toLowerCase()} est à{" "}
                  <strong className={styles.poorText}>{format(pire.metric, pire.p75)}</strong>, alors
                  que la cible est de {format(pire.metric, THRESHOLDS[pire.metric as TrackedMetric].good)} au
                  maximum.
                </>
              ) : (
                <>
                  <strong>Rien à corriger.</strong> Aucune route ne dépasse les seuils
                  critiques sur la période.
                </>
              )}
            </p>
          </section>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.routeCol}>Route</th>
                  <th className={styles.stateCol}>État</th>
                  {TRACKED_METRICS.map((m) => (
                    <th key={m}>
                      {METRIC_INFO[m].label}
                      <span className={styles.limit}>
                        {m} · cible &lt; {format(m, THRESHOLDS[m].good)}
                      </span>
                    </th>
                  ))}
                  <th>Relevés</th>
                </tr>
              </thead>
              <tbody>
                {routes.map(({ route, metrics, worst, samples }) => (
                  <tr key={route}>
                    <td className={styles.routeCol}>{route}</td>
                    <td className={styles.stateCol}>
                      {/* Le verdict en toutes lettres, et pas seulement en
                          couleur : un daltonien ne distingue pas l'ambre du
                          vert, et une capture d'écran en noir et blanc non plus. */}
                      <span className={`${styles.badge} ${styles[`badge-${worst}`]}`}>
                        {VERDICT_LABEL[worst]}
                      </span>
                    </td>
                    {TRACKED_METRICS.map((m) => {
                      const cell = metrics.get(m);
                      if (!cell) {
                        return (
                          <td key={m} className={styles.na}>
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={m} className={styles[verdict(m, cell.p75)]}>
                          {format(m, cell.p75)}
                        </td>
                      );
                    })}
                    <td className={styles.samples}>{samples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className={styles.glossary}>
            <h2 className={styles.glossaryTitle}>Ce que mesure chaque colonne</h2>
            <dl className={styles.glossaryList}>
              {TRACKED_METRICS.map((m) => (
                <div key={m} className={styles.glossaryItem}>
                  <dt className={styles.glossaryTerm}>
                    {METRIC_INFO[m].label} <span className={styles.glossaryCode}>{m}</span>
                  </dt>
                  <dd className={styles.glossaryDef}>
                    {METRIC_INFO[m].question}
                    <span className={styles.glossaryScale}>
                      Bon jusqu&apos;à {format(m, THRESHOLDS[m].good)} · à corriger au-delà de{" "}
                      {format(m, THRESHOLDS[m].poor)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
