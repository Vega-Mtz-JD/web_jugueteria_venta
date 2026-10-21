import path from "node:path";
import { test, expect } from "@playwright/test";
import { addToCart, chooseProof, loginAsNewUser } from "./helpers/session";
import { createTestUser, emailWithSubject, makeAdmin, setOrderStatus } from "./helpers/supabase-admin";

const code = (n: number) => `#${String(n).padStart(4, "0")}`;

test("el comprador y los admins reciben un correo en cada paso del pedido", async ({ page }) => {
  test.setTimeout(60_000); // cinco correos encadenados
  const owner = await createTestUser("Dueño Avisos");
  await makeAdmin(owner.id);
  const buyer = await loginAsNewUser(page, "Ana Avisos");

  await addToCart(page, "uno");
  await page.goto("/checkout");
  await page.getByLabel("Celular").fill("71234567");
  await page.getByRole("radio", { name: /Recojo en tienda/ }).check();
  await page.getByRole("button", { name: "Continuar al pago" }).click();
  await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}\/pago$/);
  const orderId = page.url().split("/").at(-2)!;

  const received = await emailWithSubject(buyer.email, "Recibimos tu pedido #");
  const number = Number(received.subject.match(/#(\d+)/)![1]);
  expect(received.html).toContain(`/pedidos/${orderId}/pago`);

  const upload = async () => {
    await page.goto(`/pedidos/${orderId}/pago`);
    await chooseProof(page, path.join(__dirname, "fixtures", "captura.png"));
    await page.getByRole("button", { name: "Enviar pedido" }).click();
    await expect(page).toHaveURL(new RegExp(`/pedidos/${orderId}$`), { timeout: 15000 });
  };
  await upload();
  const toOwner = await emailWithSubject(owner.email, `Nuevo pedido ${code(number)} · Bs `);
  expect(toOwner.html).toContain(`/panel/pedidos/${orderId}`);

  await setOrderStatus(orderId, "rechazado", { rejection_reason: "Monto incorrecto" });
  expect((await emailWithSubject(buyer.email, `No pudimos confirmar el pago del pedido ${code(number)}`)).text).toContain("Motivo: Monto incorrecto");

  await upload();
  await emailWithSubject(owner.email, `Nueva captura del pedido ${code(number)}`);
  await setOrderStatus(orderId, "pagado");
  await emailWithSubject(buyer.email, `Confirmamos tu pago del pedido ${code(number)}`);
});

test("la función de avisos no atiende sin su secreto", async ({ request }) => {
  const res = await request.post("http://127.0.0.1:54321/functions/v1/notify", { data: {} });
  expect(res.status()).toBe(401);
});

// Los servicios de push son siempre HTTPS y web-push no acepta otra cosa: este servidor TCP solo
// confirma que la función armó el aviso (VAPID + cifrado) y lo envió. Lo de "celular que ya no
// existe" (404/410) lo prueban las unitarias de dispatch.
test("la función arma el aviso al celular y lo envía al servicio de push", async () => {
  const { createServer } = await import("node:net");
  const { createECDH, randomBytes } = await import("node:crypto");
  const { adminClient } = await import("./helpers/supabase-admin");
  const admin = adminClient();
  const owner = await createTestUser("Dueño Push");
  await makeAdmin(owner.id);

  const firstBytes: number[] = [];
  const server = createServer((socket) => {
    socket.once("data", (chunk) => firstBytes.push(chunk[0]));
    socket.on("error", () => {});
    setTimeout(() => socket.destroy(), 200);
  });
  await new Promise<void>((r) => server.listen(54399, "0.0.0.0", r));
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const { error } = await admin.from("push_subscriptions").insert({
      user_id: owner.id,
      endpoint: `https://host.docker.internal:54399/${owner.id}`,
      p256dh: ecdh.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    });
    if (error) throw error;
    const { error: qe } = await admin.from("notification_outbox").insert({ kind: "prueba", audience: "admins", target_user_id: owner.id });
    if (qe) throw qe;
    // 0x16 = inicio de un saludo TLS: el aviso salió hacia el servicio de push.
    await expect.poll(() => firstBytes[0], { timeout: 20000 }).toBe(0x16);
  } finally {
    server.close();
  }
});
