import "server-only";
import webpush from "web-push";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

/**
 * Notifications push (Web Push, clés VAPID).
 *
 * Fonctionne sur Android, ordinateur, et iPhone depuis iOS 16.4 — à condition,
 * sur iPhone, d'avoir ajouté MovieTracker à l'écran d'accueil. Aucun compte
 * développeur Apple : les services push des navigateurs sont gratuits.
 *
 * Sans `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, rien n'est envoyé et
 * l'interface ne propose pas l'activation : l'application marche comme avant.
 */

export type PushCategory = "available" | "releases" | "social" | "friends";

export type PushPayload = {
  title: string;
  body: string;
  /** Page ouverte au toucher de la notification. */
  url: string;
  /** Une notification du même tag remplace la précédente au lieu de s'empiler. */
  tag?: string;
};

export type PushMessage = { userId: string; category: PushCategory; payload: PushPayload };

const PREFERENCE = {
  available: "pushAvailable",
  releases: "pushReleases",
  social: "pushSocial",
  friends: "pushFriends",
} as const satisfies Record<PushCategory, string>;

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(publicKey && privateKey);
  if (configured) {
    // Le « subject » identifie l'expéditeur auprès des services push.
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || SITE_URL, publicKey!, privateKey!);
  }
  return configured;
}

type Device = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Envoie à un appareil. « expired » : l'abonnement n'existe plus, l'appareil
 * est à oublier ; « failed » : échec passager, on le garde.
 */
async function deliver(device: Device, payload: PushPayload): Promise<"sent" | "expired" | "failed"> {
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(payload),
      // Une notification de sortie ou d'épisode n'a plus d'intérêt après un jour.
      { TTL: 86400 },
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    // 404 / 410 : l'appareil s'est désabonné ou l'abonnement a expiré.
    if (status === 404 || status === 410) return "expired";
    Sentry.captureException(error, { tags: { push: "deliver" } });
    return "failed";
  }
}

/**
 * Envoie des notifications push, en respectant les préférences de chaque
 * destinataire. Ne lève jamais : un push perdu ne doit pas faire échouer
 * l'action qui l'a déclenché.
 */
export async function sendPushes(messages: PushMessage[], { ignorePreferences = false } = {}) {
  if (messages.length === 0 || !configure()) return 0;
  try {
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        pushAvailable: true,
        pushReleases: true,
        pushSocial: true,
        pushFriends: true,
        pushDevices: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
      },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const jobs = messages.flatMap((m) => {
      const user = byId.get(m.userId);
      if (!user || (!ignorePreferences && !user[PREFERENCE[m.category]])) return [];
      return user.pushDevices.map((device) => ({ device, payload: m.payload }));
    });

    const expired: string[] = [];
    let sent = 0;
    // Par petits lots : un passage quotidien peut viser des centaines d'appareils.
    for (let i = 0; i < jobs.length; i += 20) {
      const results = await Promise.all(
        jobs.slice(i, i + 20).map(async ({ device, payload }) => {
          const result = await deliver(device, payload);
          if (result === "expired") expired.push(device.id);
          return result;
        }),
      );
      sent += results.filter((r) => r === "sent").length;
    }
    if (expired.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } });
    }
    return sent;
  } catch (error) {
    Sentry.captureException(error, { tags: { push: "send" } });
    return 0;
  }
}
