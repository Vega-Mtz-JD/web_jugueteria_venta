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

  it("con el panel abierto en otra pantalla, abre el pedido (navigate() no es confiable en Android)", async () => {
    const panel = { url: "https://ludiq.bo/panel/mas", focus: vi.fn(async () => {}), navigate: vi.fn(async () => null) };
    const { listeners, self } = loadWorker([panel]);
    await fire(listeners.notificationclick, click("/panel/pedidos/abc"));
    expect(self.clients.openWindow).toHaveBeenCalledWith("https://ludiq.bo/panel/pedidos/abc");
    expect(panel.navigate).not.toHaveBeenCalled();
  });

  it("si ese pedido ya está abierto, solo lo trae al frente", async () => {
    const panel = { url: "https://ludiq.bo/panel/pedidos/abc", focus: vi.fn(async () => {}), navigate: vi.fn(async () => null) };
    const { listeners, self } = loadWorker([panel]);
    await fire(listeners.notificationclick, click("/panel/pedidos/abc"));
    expect(panel.focus).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("si traerlo al frente falla, lo abre", async () => {
    const panel = { url: "https://ludiq.bo/panel/pedidos/abc", focus: vi.fn(async () => Promise.reject(new Error("Not allowed"))), navigate: vi.fn() };
    const { listeners, self } = loadWorker([panel]);
    await fire(listeners.notificationclick, click("/panel/pedidos/abc"));
    expect(self.clients.openWindow).toHaveBeenCalledWith("https://ludiq.bo/panel/pedidos/abc");
  });

  it("sin ventanas abiertas, abre el pedido", async () => {
    const { listeners, self } = loadWorker([]);
    await fire(listeners.notificationclick, click("/panel/pedidos/abc"));
    expect(self.clients.openWindow).toHaveBeenCalledWith("https://ludiq.bo/panel/pedidos/abc");
  });
});
