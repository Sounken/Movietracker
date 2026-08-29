/**
 * Modèle de calcul de l'assistant de notation (« Grille Express »).
 *
 * Isolé du composant pour rester testable et pour que la formule vive à un
 * seul endroit : c'est elle qui décide de la note finale, pas l'affichage.
 */

/** Les cinq niveaux proposés pour chaque critère, du plus faible au plus fort. */
export const LEVELS = [
  { label: "Faible", value: 1, color: "#e7a39b" },
  { label: "Fragile", value: 3.5, color: "#e9b59d" },
  { label: "Solide", value: 6, color: "#e7cf9c" },
  { label: "Fort", value: 8, color: "#bdd09d" },
  { label: "Exceptionnel", value: 10, color: "#98c59d" },
] as const;

/** Niveau par défaut à l'ouverture : « Solide », le milieu de l'échelle. */
export const DEFAULT_LEVEL = 6;

export type CriterionGroup = "head" | "heart";

export type Criterion = {
  id: string;
  label: string;
  /** Mot-repère affiché en petit, à droite du libellé. */
  hint: string;
  group: CriterionGroup;
};

export const CRITERIA: readonly Criterion[] = [
  { id: "realisation", label: "Réalisation", hint: "forme", group: "head" },
  { id: "scenario", label: "Scénario", hint: "fond", group: "head" },
  { id: "acting", label: "Acting", hint: "jeu", group: "head" },
  { id: "technique", label: "Image & son", hint: "technique", group: "head" },
  { id: "emotions", label: "Émotions", hint: "impact", group: "heart" },
  { id: "immersion", label: "Immersion", hint: "attention", group: "heart" },
  { id: "plaisir", label: "Plaisir", hint: "ressenti", group: "heart" },
  { id: "revoir", label: "Envie de revoir", hint: "trace", group: "heart" },
];

/**
 * « L'œuvre » plutôt que « Fabrication » : on juge ici ce que le film est en
 * lui-même, indépendamment de soi — le pendant naturel de « L'expérience »,
 * qui recueille ce qu'on en a vécu.
 */
export const GROUPS = {
  head: { label: "L'œuvre", weight: 0.58 },
  heart: { label: "L'expérience", weight: 0.42 },
} as const;

/** Ajustements proposés en un clic, sous les deux accordéons. */
export const PRESETS = {
  malus: [
    { id: "longueurs", label: "Longueurs pénalisantes", value: 0.2 },
    { id: "incoherence", label: "Incohérence majeure", value: 0.3 },
    { id: "fin", label: "Fin qui affaiblit", value: 0.2 },
    { id: "redhibitoire", label: "Élément rédhibitoire", value: 0.5 },
  ],
  bonus: [
    { id: "risque", label: "Prise de risque réussie", value: 0.2 },
    { id: "scene", label: "Scène exceptionnelle", value: 0.2 },
    { id: "originalite", label: "Originalité remarquable", value: 0.3 },
    { id: "detail", label: "Détail qui sublime", value: 0.2 },
  ],
} as const;

export type AdjustmentKind = keyof typeof PRESETS;

/**
 * Plafond de l'ajustement net. Sans lui, empiler les bonus permettrait de
 * repeindre entièrement une note construite sur huit critères : l'ajustement
 * doit nuancer le résultat, pas le remplacer.
 */
export const ADJUSTMENT_CAP = 1;

/** Plafond de la saisie libre « Autre bonus / Autre malus ». */
export const CUSTOM_CAP = 1;

export type AssistantState = {
  /** Niveau retenu pour chaque critère, indexé par `Criterion.id`. */
  levels: Record<string, number>;
  malus: string[];
  bonus: string[];
  customMalus: number;
  customBonus: number;
};

export function initialState(): AssistantState {
  return {
    levels: Object.fromEntries(CRITERIA.map((c) => [c.id, DEFAULT_LEVEL])),
    malus: [],
    bonus: [],
    customMalus: 0,
    customBonus: 0,
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** Arrondi au dixième — sans lui, les flottants sortent des 7.300000000000001. */
const round1 = (v: number) => Math.round(v * 10) / 10;

function groupAverage(state: AssistantState, group: CriterionGroup): number {
  const members = CRITERIA.filter((c) => c.group === group);
  const total = members.reduce((sum, c) => sum + (state.levels[c.id] ?? DEFAULT_LEVEL), 0);
  return total / members.length;
}

function adjustmentTotal(state: AssistantState, kind: AdjustmentKind): number {
  const selected = kind === "malus" ? state.malus : state.bonus;
  const fromPresets = PRESETS[kind]
    .filter((p) => selected.includes(p.id))
    .reduce((sum, p) => sum + p.value, 0);
  const custom = kind === "malus" ? state.customMalus : state.customBonus;
  return round1(fromPresets + clamp(custom, 0, CUSTOM_CAP));
}

export type AssistantResult = {
  head: number;
  heart: number;
  base: number;
  malus: number;
  bonus: number;
  /** Ajustement effectivement appliqué, après plafonnement. */
  delta: number;
  /** Note calculée, avant adaptation à l'échelle d'affichage. */
  score: number;
  /** Messages à afficher quand un garde-fou a modifié le résultat. */
  notices: string[];
};

export function computeAssistant(state: AssistantState): AssistantResult {
  const headRaw = groupAverage(state, "head");
  const heartRaw = groupAverage(state, "heart");

  const malus = adjustmentTotal(state, "malus");
  const bonus = adjustmentTotal(state, "bonus");

  const rawDelta = round1(bonus - malus);
  const delta = round1(clamp(rawDelta, -ADJUSTMENT_CAP, ADJUSTMENT_CAP));

  const baseRaw = headRaw * GROUPS.head.weight + heartRaw * GROUPS.heart.weight;
  const rawScore = baseRaw + delta;
  const score = round1(clamp(rawScore, 0, 10));

  const notices: string[] = [];
  if (Math.abs(rawDelta - delta) > 0.01) {
    notices.push(`Ajustement net plafonné à ${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}.`);
  }
  if (rawScore < 0 || rawScore > 10) {
    notices.push(`Note ramenée à ${rawScore > 10 ? "10,0" : "0,0"}.`);
  }

  return {
    head: round1(headRaw),
    heart: round1(heartRaw),
    base: round1(baseRaw),
    malus,
    bonus,
    delta,
    score,
    notices,
  };
}

/**
 * Ramène la note au dixième, dans les deux échelles.
 *
 * On arrondissait au demi-point sur /10 pour coller aux étoiles, mais c'était
 * gâcher la précision de huit critères : l'assistant calcule 6,1 ou 6,2, et
 * rien n'empêche de les stocker — la note est un Float, et un 6,1 s'affiche
 * très bien à côté d'étoiles qui, elles, restent au demi-cran. Les étoiles
 * contraignent la saisie à la souris, pas ce que l'assistant peut produire.
 */
export function snapToScale(score: number): number {
  return Math.round(score * 10) / 10;
}
