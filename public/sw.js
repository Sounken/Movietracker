/*
 * Service worker de MovieTracker : uniquement les notifications push.
 *
 * Aucun cache, aucune interception des requêtes : l'application se comporte
 * exactement comme sur le web. Il ne sert qu'à recevoir un push quand
 * l'application est fermée et à ouvrir la bonne page au toucher.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "MovieTracker", {
      body: data.body || "",
      icon: "/pwa-icon/192",
      badge: "/pwa-icon/96",
      tag: data.tag,
      data: { url: data.url || "/films" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/films", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Une fenêtre déjà ouverte est réutilisée plutôt que d'en ouvrir une autre.
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        return existing.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
