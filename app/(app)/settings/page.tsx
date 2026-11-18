import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserWatchProviders } from "@/lib/user-settings";
import { prisma } from "@/lib/db";
import { vapidPublicKey } from "@/lib/push";
import SettingsClient from "./SettingsClient";

export const metadata: Metadata = {
  title: "Réglages",
  robots: { index: false },
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [watchProviders, prefs] = await Promise.all([
    getUserWatchProviders(session.userId),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { pushAvailable: true, pushReleases: true, pushSocial: true, pushFriends: true },
    }),
  ]);

  return (
    <SettingsClient
      watchProviders={watchProviders}
      pushPreferences={prefs ?? { pushAvailable: true, pushReleases: true, pushSocial: true, pushFriends: false }}
      pushConfigured={vapidPublicKey() !== null}
    />
  );
}
