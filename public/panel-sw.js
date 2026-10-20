// Service worker del panel: muestra los avisos de pedidos y, al tocarlos, abre ese pedido.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "Ludiq" };
  }
  const title = data.title || "Ludiq · Panel";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/panel-192.png",
      badge: "/icons/panel-192.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/panel" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/panel", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const panel = windows.find((w) => new URL(w.url).pathname.startsWith("/panel"));
      if (panel) {
        await panel.focus();
        return panel.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
