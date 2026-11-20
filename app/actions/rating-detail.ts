"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  CRITERIA,
  CUSTOM_CAP,
  DEFAULT_LEVEL,
  LEVELS,
  PRESETS,
  computeAssistant,
  type AssistantState,
} from "@/lib/rating-assistant";

type Media = "movie" | "tv";

/**
 * Ne garde de l'état reçu que ce que l'assistant sait produire : critères et
 * niveaux connus, bonus / malus de la liste, saisies libres bornées. L'état
 * arrive du navigateur, il ne doit pas pouvoir glisser n'importe quoi en base.
 */
function sanitize(input: AssistantState): AssistantState {
  const allowedLevels = new Set<number>(LEVELS.map((l) => l.value));
  const clampCustom = (v: unknown) => Math.min(CUSTOM_CAP, Math.max(0, Math.round(Number(v) * 10) / 10 || 0));
  const presetIds = (kind: "malus" | "bonus", list: unknown) => {
    const ids = new Set<string>(PRESETS[kind].map((p) => p.id));
    return Array.isArray(list) ? [...new Set(list.filter((id): id is string => typeof id === "string" && ids.has(id)))] : [];
  };
  return {
    levels: Object.fromEntries(
      CRITERIA.map((c) => {
        const v = Number(input.levels?.[c.id]);
        return [c.id, allowedLevels.has(v) ? v : DEFAULT_LEVEL];
      }),
    ),
    malus: presetIds("malus", input.malus),
    bonus: presetIds("bonus", input.bonus),
    customMalus: clampCustom(input.customMalus),
    customBonus: clampCustom(input.customBonus),
  };
}

/**
 * Enregistre les notes détaillées de « M'aider à noter ». La note finale est
 * enregistrée à part (saveRating / saveSeriesRating) : l'utilisateur peut la
 * retoucher aux étoiles sans perdre son détail.
 */
export async function saveRatingDetail(media: Media, tmdbId: number, state: AssistantState) {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié");
  if (media !== "movie" && media !== "tv") throw new Error("Média inconnu");

  const clean = sanitize(state);
  const score = computeAssistant(clean).score;
  const where = { userId_media_tmdbId: { userId: session.userId, media, tmdbId } };

  await prisma.ratingDetail.upsert({
    where,
    update: { state: clean, score },
    create: { userId: session.userId, media, tmdbId, state: clean, score },
  });
  revalidatePath(media === "movie" ? `/film/${tmdbId}` : `/series/${tmdbId}`);
}
