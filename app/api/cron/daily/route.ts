import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { runAvailabilityAlerts, runEpisodeAlerts, runReleaseReminders } from "@/lib/daily";

/**
 * Passage quotidien : rappels de sortie, nouveaux épisodes, arrivées en
 * streaming des films de « À voir ».
 *
 * Appelé chaque matin par une tâche planifiée Coolify :
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
 *
 * Sans `CRON_SECRET` configuré, la route refuse tout : mieux vaut une tâche
 * qui échoue bruyamment qu'une route ouverte à n'importe qui.
 */
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function step<T>(name: string, run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run();
  } catch (error) {
    // Une tâche en échec ne prive pas les suivantes de leur passage.
    Sentry.captureException(error, { tags: { cron: name } });
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const releases = await step("releases", () => runReleaseReminders());
  const episodes = await step("episodes", () => runEpisodeAlerts());
  const available = await step("available", () => runAvailabilityAlerts());

  // Le détail des lignes envoyées reste côté serveur : la réponse ne sert
  // qu'au journal de la tâche planifiée.
  const summary = (r: unknown) => {
    if (r && typeof r === "object" && "sentRows" in r) {
      const { sentRows, ...rest } = r as Record<string, unknown>;
      void sentRows;
      return rest;
    }
    return r;
  };
  return NextResponse.json({
    releases: summary(releases),
    episodes: summary(episodes),
    available: summary(available),
  });
}
