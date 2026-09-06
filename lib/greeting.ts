import "server-only";

/**
 * Salutation de l'en-tête, déclinée par tranche horaire.
 *
 * Le calcul vivait auparavant dans quatorze pages, copié à l'identique :
 * `hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir"`. Passer de
 * trois tranches à cinq et y ajouter des variantes aurait multiplié cette
 * duplication par dix.
 *
 * `server-only` est délibéré. La salutation doit être décidée au rendu serveur
 * et transmise en prop : la calculer côté client produirait un écart entre le
 * HTML envoyé et le premier rendu du navigateur, donc un avertissement
 * d'hydratation et un remplacement visible du titre.
 */

type Period = "nuit" | "matin" | "midi" | "apresMidi" | "soir";

/** Ordre stable, utilisé comme composante de la graine. */
const PERIODS: readonly Period[] = ["nuit", "matin", "midi", "apresMidi", "soir"];

/**
 * Les variantes doivent toutes se lire suivies d'une virgule et du prénom —
 * « Belle soirée, Damien. » — puisque c'est le gabarit du titre.
 */
const VARIATIONS: Record<Period, readonly string[]> = {
  nuit: ["Bonne nuit", "Encore debout", "Nuit blanche", "Il se fait tard", "Bonsoir"],
  matin: ["Bonjour", "Belle matinée", "Bien le bonjour", "Déjà debout", "Bonne matinée"],
  midi: ["Bon appétit", "Bonjour", "Pause déjeuner", "Belle journée", "Bon midi"],
  apresMidi: ["Bon après-midi", "Bel après-midi", "Bonjour", "Doux après-midi", "Belle journée"],
  soir: ["Bonsoir", "Belle soirée", "Bonne soirée", "Douce soirée", "La soirée commence"],
};

function periodFor(hour: number): Period {
  if (hour < 6) return "nuit";
  if (hour < 12) return "matin";
  if (hour < 14) return "midi";
  if (hour < 18) return "apresMidi";
  return "soir";
}

/**
 * Heure et date à Paris, et non celles du serveur.
 *
 * `new Date().getHours()` rend l'heure du conteneur, c'est-à-dire UTC : en
 * heure d'été, un visiteur français à 19h était accueilli par « Bon
 * après-midi ». Le décalage passait pour anodin avec trois tranches ; il
 * devient faux la moitié du temps avec cinq, où midi ne dure que deux heures.
 *
 * `hourCycle: "h23"` évite le « 24 » que certaines locales rendent à minuit.
 */
const PARIS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hourCycle: "h23",
  hour: "2-digit",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Tirage déterministe : la même graine rend toujours la même variante.
 *
 * Le brassage n'est pas cosmétique. Sans lui, `graine % longueur` ferait
 * défiler la liste dans l'ordre d'un jour à l'autre, et la « variation » se
 * lirait comme un cycle — l'utilisateur régulier verrait un compteur, pas une
 * surprise.
 */
function pick(list: readonly string[], seed: number): string {
  let x = seed >>> 0;
  x = (x ^ (x << 13)) >>> 0;
  x = (x ^ (x >>> 17)) >>> 0;
  x = (x ^ (x << 5)) >>> 0;
  return list[x % list.length]!;
}

/**
 * Salutation du moment.
 *
 * Stable à l'intérieur d'une tranche et d'une journée : elle ne change pas
 * d'une page à l'autre pendant qu'on navigue, mais bascule au passage de
 * tranche et se renouvelle le lendemain. Un tirage à chaque requête ferait
 * changer le titre à chaque clic.
 */
export function getGreeting(now: Date = new Date()): string {
  const parts = Object.fromEntries(PARIS.formatToParts(now).map((p) => [p.type, p.value]));

  const period = periodFor(Number(parts.hour));
  const day = Number(`${parts.year}${parts.month}${parts.day}`);

  return pick(VARIATIONS[period], day * PERIODS.length + PERIODS.indexOf(period));
}
