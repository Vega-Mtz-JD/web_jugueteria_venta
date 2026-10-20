import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { adminClient } from "./helpers/supabase-admin";

/** Chromium de prueba no puede suscribirse a un servicio de push real: se reemplaza PushManager. */
async function fakePush(page: Page, endpoint: string) {
  await page.addInitScript((ep) => {
    let current: PushSubscription | null = null;
    const fake = {
      endpoint: ep,
      toJSON: () => ({ endpoint: ep, keys: { p256dh: "BPfakeP256dhKeyForTests", auth: "fakeAuthKey" } }),
      unsubscribe: async () => {
        current = null;
        return true;
      },
    } as unknown as PushSubscription;
    // Chromium sin interfaz responde "denied" aunque se otorgue el permiso: se simula "aún no decidido → aceptar".
    let permission: NotificationPermission = "default";
    Object.defineProperty(Notification, "permission", { get: () => permission });
    Notification.requestPermission = async () => (permission = "granted");
    PushManager.prototype.subscribe = async () => (current = fake);
    PushManager.prototype.getSubscription = async () => current;
  }, endpoint);
}

async function rows(userId: string) {
  const { data } = await adminClient().from("push_subscriptions").select("endpoint").eq("user_id", userId);
  return (data ?? []).map((r) => r.endpoint);
}

test.describe("avisos en el panel", () => {
  test("activar, probar y desactivar los avisos de este dispositivo", async ({ page }) => {
    const endpoint = `https://push.example/${crypto.randomUUID()}`;
    await fakePush(page, endpoint);
    const admin = await loginAsAdmin(page);
    await page.goto("/panel/mas");
    const section = page.getByRole("region", { name: "Avisos en este dispositivo" });

    await section.getByRole("button", { name: "Activar avisos" }).click();
    await expect(section.getByText("Avisos activados en este dispositivo")).toBeVisible();
    expect(await rows(admin.id)).toEqual([endpoint]);

    await section.getByRole("button", { name: "Enviar aviso de prueba" }).click();
    await expect(section.getByRole("status")).toHaveText("Enviamos un aviso de prueba");
    const { data: queued } = await adminClient().from("notification_outbox").select("kind").eq("target_user_id", admin.id);
    expect(queued?.map((q) => q.kind)).toEqual(["prueba"]);

    await section.getByRole("button", { name: "Desactivar" }).click();
    await expect(section.getByRole("button", { name: "Activar avisos" })).toBeVisible();
    await expect.poll(() => rows(admin.id)).toEqual([]);
  });

  test("si el navegador bloqueó los avisos, lo explica", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Notification, "permission", { get: () => "denied" });
      Notification.requestPermission = async () => "denied";
    });
    await loginAsAdmin(page);
    await page.goto("/panel/mas");
    await expect(page.getByText("Los avisos están bloqueados. Actívalos en los ajustes del navegador para este sitio.")).toBeVisible();
  });

  test("si el navegador no permite avisos, lo explica", async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error: simular un navegador sin Web Push (p. ej. iPhone sin instalar el panel)
      delete window.PushManager;
    });
    await loginAsAdmin(page);
    await page.goto("/panel/mas");
    await expect(page.getByText("Este navegador no permite avisos. En iPhone, primero instala el panel en la pantalla de inicio.")).toBeVisible();
  });
});
