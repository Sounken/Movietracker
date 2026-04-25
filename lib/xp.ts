const LEVELS = [
  { level: 1, title: "Novice",          xp: 0 },
  { level: 2, title: "Spectateur",      xp: 100 },
  { level: 3, title: "Amateur",         xp: 300 },
  { level: 4, title: "Cinéphile",       xp: 700 },
  { level: 5, title: "Passionné",       xp: 1_500 },
  { level: 6, title: "Critique",        xp: 3_000 },
  { level: 7, title: "Connaisseur",     xp: 6_000 },
  { level: 8, title: "Expert",          xp: 12_000 },
  { level: 9, title: "Maître du 7e art", xp: 25_000 },
];

const MAX_FIXED = LEVELS[LEVELS.length - 1];

type FilmEntry = {
  rating:    number | null;
  review:    string | null;
  liked:     boolean;
  watched:   boolean;
};

export function computeXP(films: FilmEntry[]): number {
  return films.reduce((total, f) => {
    let xp = 0;
    if (f.rating !== null) xp += 15;
    else if (f.watched)    xp += 8;
    if (f.review)          xp += 20;
    if (f.liked)           xp += 5;
    return total + xp;
  }, 0);
}

export type LevelInfo = {
  level:       number;
  title:       string;
  currentXP:   number; // XP accumulated within this level
  nextLevelXP: number; // XP needed to reach next level
  totalXP:     number;
  percent:     number; // 0-100
};

export function getLevelInfo(totalXP: number): LevelInfo {
  // Find the highest fixed level the user has reached
  let idx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVELS[i].xp) { idx = i; break; }
  }

  if (idx < LEVELS.length - 1) {
    // Within fixed levels
    const cur = LEVELS[idx];
    const nxt = LEVELS[idx + 1];
    const currentXP   = totalXP - cur.xp;
    const nextLevelXP = nxt.xp - cur.xp;
    return {
      level: cur.level,
      title: cur.title,
      currentXP,
      nextLevelXP,
      totalXP,
      percent: Math.min(100, Math.round((currentXP / nextLevelXP) * 100)),
    };
  }

  // Beyond level 9 — each step is 50% more than the previous
  // Level 9→10: 25000 * 0.5 = 12500, 10→11: 12500 * 1.5 = 18750, etc.
  let levelNum   = MAX_FIXED.level;
  let threshold  = MAX_FIXED.xp;          // start of current level
  let step       = MAX_FIXED.xp * 0.5;    // 12 500 XP for level 9→10

  while (totalXP >= threshold + step) {
    threshold += step;
    step = Math.round(step * 1.5);
    levelNum++;
  }

  const currentXP   = totalXP - threshold;
  const nextLevelXP = Math.round(step);
  return {
    level: levelNum,
    title: MAX_FIXED.title,
    currentXP,
    nextLevelXP,
    totalXP,
    percent: Math.min(100, Math.round((currentXP / nextLevelXP) * 100)),
  };
}
