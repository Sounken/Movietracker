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

function verdict(metric: string, value: number): "good" | "needs-improvement" | "poor" {
  const t = THRESHOLDS[metric as TrackedMetric];
  if (!t) return "needs-improvement";
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

function format(metric: string, value: number): string {
  const t = THRESHOLDS[metric as TrackedMetric];
  if (metric === "CLS") return value.toFixed(3);
  return `${Math.round(value)}${t?.unit ?? ""}`;
}

export default async function VitalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await fetchVitals(7);

  const routes = [...new Set(rows.map((r) => r.route))];
  const byRoute = new Map(routes.map((r) => [r, new Map(rows.filter((x) => x.route === r).map((x) => [x.metric, x]))]));

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Performances perçues</h1>
      <p className={styles.intro}>
        75<sup>e</sup> centile sur les sept derniers jours, mesuré chez les
        visiteurs. Les routes comptant moins de trois relevés sont masquées.
      </p>

      {rows.length === 0 ? (
        <p className={styles.empty}>
          Aucune mesure pour l&apos;instant. Les relevés arrivent au fil des
          visites — comptez quelques minutes après un déploiement.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.routeCol}>Route</th>
                {TRACKED_METRICS.map((m) => (
                  <th key={m}>
                    {m}
                    <span className={styles.limit}>
                      &lt; {format(m, THRESHOLDS[m].good)}
                    </span>
                  </th>
                ))}
                <th>Relevés</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => {
                const metrics = byRoute.get(route)!;
                const samples = Math.max(...[...metrics.values()].map((v) => Number(v.samples)));
                return (
                  <tr key={route}>
                    <td className={styles.routeCol}>{route}</td>
                    {TRACKED_METRICS.map((m) => {
                      const cell = metrics.get(m);
                      if (!cell) return <td key={m} className={styles.na}>—</td>;
                      return (
                        <td key={m} className={styles[verdict(m, cell.p75)]}>
                          {format(m, cell.p75)}
                        </td>
                      );
                    })}
                    <td className={styles.samples}>{samples}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
