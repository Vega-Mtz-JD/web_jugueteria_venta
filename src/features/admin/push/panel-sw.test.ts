import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

type Listener = (event: { waitUntil(p: Promise<unknown>): void; notification?: unknown; data?: unknown }) => void;

/** Carga public/panel-sw.js con un `self` falso y devuelve sus listeners. */
function loadWorker(windows: { url: string; focus: () => Promise<unknown>; navigate: (u: string) => Promise<unknown> }[]) {
  const listeners: Record<string, Listener> = {};
  const self = {
    addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
    skipWaiting: vi.fn(async () => {}),
    location: { origin: "https://ludiq.bo" },
    registration: { showNotification: vi.fn(async () => {}) },
    clients: { matchAll: vi.fn(async () => windows), openWindow: vi.fn(async () => null), claim: vi.fn(async () => {}) },
  };
  new Function("self", readFileSync(path.join(process.cwd(), "public/panel-sw.js"), "utf8"))(self);
  return { listeners, self };
}

async function fire(listener: Listener, extra: object = {}) {
  let done: Promise<unknown> = Promise.resolve();
  listener({ waitUntil: (p) => (done = p), ...extra });
  await done;
}

const click = (url: string) => ({ notification: { close: vi.fn(), data: { url } } });

describe("panel-sw.js", () => {
  it("toma el control de las ventanas abiertas al activarse y se instala sin esperar", async () => {
    const { listeners, self } = loadWorker([]);
    await fire(listeners.install);
    await fire(listeners.activate);
    expect(self.skipWaiting).toHaveBeenCalled();
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it("si la ventana del panel no se deja navegar (no controlada), abre el pedido en una nueva", async () => {
    const panel = { url: "https://ludiq.bo/panel/mas", focus: vi.fn(async () => {}), navigate: vi.fn(async () => Promise.reject(new TypeError("not controlled"))) };
    const { listeners, self } = loadWorker([panel]);
    await fire(listeners.notificationclick, click("/panel/pedidos/abc"));
    expect(self.clients.openWindow).toHaveBeenCalledWith("https://ludiq.bo/panel/pedidos/abc");
  });

  it("con una ventana del panel controlada, la lleva al pedido", async () => {
    const panel = { url: "https://ludiq.bo/panel", focus: vi.fn(async () => {}), navigate: vi.fn(async () => ({})) };
    const { listeners, self } = loadWorker([panel]);
    await fire(listeners.notificationclick, click("/panel/pedidos/abc"));
    expect(panel.navigate).toHaveBeenCalledWith("https://ludiq.bo/panel/pedidos/abc");
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("sin ventanas abiertas, abre el pedido", async () => {
    const { listeners, self } = loadWorker([]);
    await fire(listeners.notificationclick, click("/panel/pedidos/abc"));
    expect(self.clients.openWindow).toHaveBeenCalledWith("https://ludiq.bo/panel/pedidos/abc");
  });
});
