import "server-only";

import { getSession } from "./session";
import { prisma } from "./db";
import { DEFAULT_RATING_SCALE, toRatingScale, type RatingScale } from "./rating";

/**
 * Échelle de notation de l'utilisateur connecté, lue par les layouts pour
 * alimenter le contexte client. Les visiteurs non connectés restent sur /10.
 */
export async function getUserRatingScale(): Promise<RatingScale> {
  const session = await getSession();
  if (!session) return DEFAULT_RATING_SCALE;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { ratingScale: true },
  });

  return toRatingScale(user?.ratingScale);
}
