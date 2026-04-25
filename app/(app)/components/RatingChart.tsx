import styles from "./RatingChart.module.css";

const COLORS: Record<number, string> = {
  1: "#c2412c", 2: "#c2412c", 3: "#d97742",
  4: "#d97742", 5: "#c9a227", 6: "#c9a227",
  7: "#7ab06a", 8: "#7ab06a", 9: "#4caf7d", 10: "#4caf7d",
};

export default function RatingChart({ distribution }: { distribution: Record<number, number> }) {
  const max = Math.max(...Object.values(distribution), 1);
  const total = Object.values(distribution).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>Répartition des notes</div>
      <div className={styles.bars}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => {
          const count = distribution[r] || 0;
          const pct = Math.round((count / max) * 100);
          return (
            <div key={r} className={styles.col}>
              <div className={styles.countLabel}>{count > 0 ? count : ""}</div>
              <div className={styles.barTrack}>
                <div
                  className={styles.bar}
                  style={{
                    height: `${pct}%`,
                    background: COLORS[r],
                    opacity: count === 0 ? 0.15 : 1,
                  }}
                />
              </div>
              <div className={styles.ratingLabel}>{r}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
