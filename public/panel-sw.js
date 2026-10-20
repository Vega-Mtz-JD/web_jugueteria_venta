// Service worker del panel: muestra los avisos de pedidos y, al tocarlos, abre ese pedido.

// Sin esperar a que se cierre el panel instalado (se queda abierto días) y tomando el control de las
// ventanas ya abiertas: una ventana no controlada no se deja llevar al pedido con navigate().
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
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
        try {
          await panel.focus();
          return await panel.navigate(url);
        } catch {
          // Ventana que este service worker no controla: abrir el pedido en una nueva.
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
