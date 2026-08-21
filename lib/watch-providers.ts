import { WATCH_PROVIDERS } from "@/lib/tmdb";

/** Identifiants autorisés — tout le reste est ignoré. */
const KNOWN = new Set(WATCH_PROVIDERS.map((p) => p.id));

/**
 * Lit le paramètre `providers` de l'URL (« 8,119 ») en liste d'identifiants.
 *
 * Les valeurs sont filtrées sur la liste blanche : elles finissent concaténées
 * dans une URL TMDB, et un identifiant inconnu ferait au mieux une requête
 * vide, au pire un paramètre injecté.
 */
export function parseProviders(raw: string | null | undefined): number[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((id) => Number.isInteger(id) && KNOWN.has(id));
  return ids.length > 0 ? ids : undefined;
}

/** Sérialise une sélection pour l'URL. */
export function serializeProviders(ids: number[]): string {
  return ids.filter((id) => KNOWN.has(id)).join(",");
}
