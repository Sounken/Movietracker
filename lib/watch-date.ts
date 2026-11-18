/** Jour (UTC) d'un visionnage, à la française : « 12 nov. 2026 ». */
const WATCH_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatWatchDate(iso: string | Date): string {
  return WATCH_DATE.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Date du jour dans le fuseau du navigateur, au format des champs date. */
export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
