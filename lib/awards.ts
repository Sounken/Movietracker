import { unstable_cache } from "next/cache";

/**
 * Distinctions réelles, depuis Wikidata.
 *
 * La fiche film devinait jusqu'ici les récompenses en cherchant « oscar » ou
 * « cannes » dans les mots-clés TMDB — ce qui rate les films primés sans
 * mot-clé, et affiche « oscar » sur des films seulement nommés.
 *
 * Wikidata expose la propriété P166 (« distinction reçue »), datée et
 * qualifiée. TMDB nous donne le pont : `external_ids.wikidata_id`.
 *
 * Le point d'entrée SPARQL (query.wikidata.org) serait plus expressif mais il
 * est fortement limité en débit — observé à 1 requête/minute pendant un
 * incident. On passe donc par l'API MediaWiki classique, bien plus tolérante :
 *   1. `Special:EntityData/{Q}.json` → les identifiants des distinctions
 *   2. `wbgetentities` → leurs libellés, tous en un seul appel
 */

const WIKIDATA = "https://www.wikidata.org";
const UA = "movietracker/1.0 (https://github.com/) awards-lookup";

export type Award = {
  id: string;
  label: string;
  /** Année de remise, si Wikidata la qualifie (P585). */
  year: string | null;
  /** Distinction majeure : remonte en tête et se voit davantage. */
  major: boolean;
};

/**
 * Les palmarès qui parlent au public. Une fiche peut cumuler des dizaines de
 * prix techniques ou régionaux : on met en avant ceux-ci et on relègue le reste.
 */
const MAJOR = /(oscar|academy award|golden globe|bafta|british academy|palme d'or|cannes|césar|emmy|screen actors guild|lion d'or|ours d'or|goya)/i;

/** Prix « nommé pour » et catégories parasites qu'on ne veut pas afficher. */
const EXCLUDED = /(nomination|nommé)/i;

async function wikidataJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 2592000 }, // 30 jours : un palmarès ne bouge plus
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type Claim = {
  mainsnak?: { datavalue?: { value?: { id?: string } } };
  qualifiers?: { P585?: Array<{ datavalue?: { value?: { time?: string } } }> };
};

/**
 * Distinctions d'une entité Wikidata, triées : les majeures d'abord, puis par
 * année décroissante. Renvoie un tableau vide si Wikidata est injoignable —
 * une fiche doit s'afficher même sans son palmarès.
 */
async function fetchAwardsUncached(wikidataId: string): Promise<Award[]> {
  if (!/^Q\d+$/.test(wikidataId)) return [];

  const entityData = await wikidataJson(
    `${WIKIDATA}/wiki/Special:EntityData/${wikidataId}.json`,
  );
  if (!entityData) return [];

  const entities = entityData.entities as Record<string, { claims?: Record<string, Claim[]> }> | undefined;
  const claims = entities?.[wikidataId]?.claims?.P166 ?? [];
  if (claims.length === 0) return [];

  // Identifiant + année de chaque distinction, dédoublonnés : un même prix
  // remporté plusieurs fois (série récompensée 4 ans de suite) apparaîtrait
  // autrement en double dans la liste.
  const byId = new Map<string, string | null>();
  for (const claim of claims) {
    const id = claim.mainsnak?.datavalue?.value?.id;
    if (!id) continue;
    const time = claim.qualifiers?.P585?.[0]?.datavalue?.value?.time;
    const year = time ? time.slice(1, 5) : null;
    // On garde l'année la plus récente pour un prix répété.
    const existing = byId.get(id);
    if (existing === undefined || (year && (!existing || year > existing))) {
      byId.set(id, year);
    }
  }

  // wbgetentities accepte 50 identifiants par appel : un seul suffit ici.
  const ids = [...byId.keys()].slice(0, 50);
  const labelData = await wikidataJson(
    `${WIKIDATA}/w/api.php?action=wbgetentities&ids=${ids.join("|")}` +
      `&props=labels&languages=fr|en&format=json&origin=*`,
  );

  const labelEntities =
    (labelData?.entities as Record<string, { labels?: Record<string, { value: string }> }>) ?? {};

  const awards: Award[] = ids
    .map((id) => {
      const labels = labelEntities[id]?.labels;
      const label = labels?.fr?.value ?? labels?.en?.value ?? "";
      if (!label || EXCLUDED.test(label)) return null;
      return {
        id,
        // Wikidata écrit parfois « oscar du meilleur acteur » en minuscule.
        label: label.charAt(0).toUpperCase() + label.slice(1),
        year: byId.get(id) ?? null,
        major: MAJOR.test(label),
      };
    })
    .filter((a): a is Award => a !== null);

  return awards.sort(
    (a, b) =>
      Number(b.major) - Number(a.major) ||
      (b.year ?? "").localeCompare(a.year ?? "") ||
      a.label.localeCompare(b.label, "fr"),
  );
}

/**
 * Version mise en cache. Le cache de `fetch` couvre déjà les appels réseau ;
 * celui-ci évite en plus de refaire le tri et le nettoyage à chaque rendu.
 */
export const fetchAwards = unstable_cache(fetchAwardsUncached, ["wikidata-awards"], {
  revalidate: 2592000,
});
