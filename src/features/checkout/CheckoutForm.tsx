"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BusIcon, MapPinIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoreSettings } from "@/features/catalog/types";
import { useCartProducts } from "@/features/cart/useCartProducts";
import { formatBs } from "@/lib/money";
import { cn } from "@/lib/utils";
import { createOrderAction } from "./actions";
import { estimateDeliveryFee, type DeliveryMethod } from "./delivery";
import type { CheckoutOptions } from "./queries";
import { checkoutSchema, DEPARTMENTS } from "./schema";

const field =
  "h-11 w-full rounded-lg border border-input bg-papel px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-rojo";

type Errors = Partial<Record<string, string>>;

/**
 * Clave de idempotencia del pedido, guardada por contenido del carrito en sessionStorage:
 * si la respuesta se pierde y la persona reintenta o recarga, la base devuelve el mismo pedido.
 */
function requestIdFor(lines: { productId: string; quantity: number }[]): { id: string; forget: () => void } {
  const key = `ludiq:pedido:${lines.map((l) => `${l.productId}x${l.quantity}`).sort().join(",")}`;
  let id: string | null = null;
  try {
    id = sessionStorage.getItem(key);
    if (!id) sessionStorage.setItem(key, (id = crypto.randomUUID()));
  } catch {
    id ??= crypto.randomUUID();
  }
  return {
    id,
    forget: () => {
      try {
        sessionStorage.removeItem(key);
      } catch {}
    },
  };
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}

const METHODS: { value: DeliveryMethod; title: string; text: string; icon: typeof StoreIcon }[] = [
  { value: "recojo", title: "Recojo en tienda", text: "Sin costo. Te avisamos cuando esté listo.", icon: StoreIcon },
  { value: "envio_ciudad", title: "Envío dentro de La Paz", text: "A domicilio o en un punto de encuentro.", icon: MapPinIcon },
  { value: "encomienda", title: "Encomienda por bus a otro departamento", text: "Lo enviamos a nombre de quien recoge.", icon: BusIcon },
];

export function CheckoutForm({
  options,
  store,
  defaults,
}: {
  options: CheckoutOptions;
  store: StoreSettings;
  defaults: { name: string; phone: string };
}) {
  const router = useRouter();
  const { lines, products, visible, subtotal, adjusted, clear, refresh } = useCartProducts();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [method, setMethod] = useState<DeliveryMethod | null>(null);
  const [recipientName, setRecipientName] = useState(defaults.name);
  const [phone, setPhone] = useState(defaults.phone);
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");
  const [addressReference, setAddressReference] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [meetingPointCustom, setMeetingPointCustom] = useState("");
  const [recipientCi, setRecipientCi] = useState("");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [invoiceRequested, setInvoiceRequested] = useState(false);
  const [invoiceNit, setInvoiceNit] = useState("");
  const [invoiceName, setInvoiceName] = useState("");

  const zone = options.zones.find((z) => z.id === zoneId) ?? null;
  const fee = method ? estimateDeliveryFee(method, zone?.mode ?? null, options.fees) : 0;

  if (lines.length === 0 && adjusted.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-input bg-papel px-6 py-14 text-center">
        <p className="font-serif text-xl font-bold">Tu carrito está vacío</p>
        <Button asChild className="mt-6">
          <Link href="/catalogo">Ver catálogo</Link>
        </Button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setFormError(null);
    const input = {
      method: method ?? undefined,
      recipientName,
      phone,
      zoneId,
      zoneMode: zone?.mode,
      address,
      addressReference,
      meetingPointId: meetingPoint && meetingPoint !== "otro" ? meetingPoint : "",
      meetingPointCustom: meetingPoint === "otro" ? meetingPointCustom : "",
      recipientCi,
      department,
      city,
      invoiceRequested,
      invoiceNit,
      invoiceName,
    };
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? "method"), i.message])));
      return;
    }
    setErrors({});
    setPending(true);
    const request = requestIdFor(lines);
    try {
      const result = await createOrderAction({ ...parsed.data, requestId: request.id, items: lines });
      if ("orderId" in result) {
        request.forget();
        clear();
        router.push(`/pedidos/${result.orderId}/pago`);
        return;
      }
      setFormError(result.error);
      await refresh().catch(() => {});
    } catch {
      setFormError(
        "No pudimos confirmar tu pedido: revisa tu conexión y vuelve a tocar «Continuar al pago». No se creará un pedido repetido.",
      );
    }
    setPending(false);
  }

  const err = (k: string) => errors[k];
  const aria = (k: string) => ({ "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `${k}-error` : undefined });

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 md:grid-cols-[1fr_20rem]">
      <div className="grid min-w-0 gap-8">
        {adjusted.length > 0 && (
          <p role="status" className="rounded-xl bg-mostaza/15 px-4 py-3 text-sm font-medium">
            Ajustamos tu carrito: {adjusted.map((n) => `«${n}»`).join(", ")} ya no está disponible o no tiene stock suficiente.
          </p>
        )}

        <section className="grid gap-4">
          <h2 className="font-serif text-xl font-bold">Tus datos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
              <Field id="recipientName" label={method === "encomienda" ? "Nombre completo de quien recoge" : "Nombre de quien recibe"} error={err("recipientName")}>
                <input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} autoComplete="name" className={field} {...aria("recipientName")} />
              </Field>
              <Field id="phone" label="Celular" error={err("phone")}>
                <input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="Ej.: 71234567" className={field} {...aria("phone")} />
              </Field>
          </div>
        </section>

        <fieldset className="grid gap-3">
          <legend className="mb-3 font-serif text-xl font-bold">¿Cómo quieres recibirlo?</legend>
          {METHODS.map((m) => (
            <label
              key={m.value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-2xl border bg-papel p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                method === m.value ? "border-verde bg-[#eef3ec]" : "border-[#eadcc4] hover:border-madera",
              )}
            >
              <input
                type="radio"
                name="method"
                value={m.value}
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
                className="mt-1 size-4 accent-verde"
              />
              <m.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-verde" />
              <span>
                <span className="block font-semibold">{m.title}</span>
                <span className="block text-sm text-muted-foreground">{m.text}</span>
              </span>
            </label>
          ))}
          {err("method") && <p className="text-sm font-medium text-rojo">{err("method")}</p>}
        </fieldset>

        {method && (
          <section className="grid gap-4 rounded-2xl bg-crema-2 p-4 sm:p-5">
            {method === "recojo" && (
              <p className="text-sm">
                Recoge en <strong>{store.address ?? "la tienda"}</strong>
                {store.pickupHours && <> · {store.pickupHours}</>}. Te avisaremos cuando tu pedido esté listo.
              </p>
            )}

            {method === "envio_ciudad" && (
              <>
                <Field id="zoneId" label="Zona" error={err("zoneId")}>
                  <select id="zoneId" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={field} {...aria("zoneId")}>
                    <option value="">Elige tu zona</option>
                    {options.zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.mode === "punto" ? `${z.name} (punto de encuentro)` : z.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {zone?.mode === "domicilio" && (
                  <>
                    <Field id="address" label="Dirección" error={err("address")}>
                      <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" className={field} {...aria("address")} />
                    </Field>
                    <Field id="addressReference" label="Referencia (opcional)">
                      <input id="addressReference" value={addressReference} onChange={(e) => setAddressReference(e.target.value)} placeholder="Ej.: portón verde, frente a la farmacia…" className={field} />
                    </Field>
                  </>
                )}
                {zone?.mode === "punto" && (
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 text-sm font-medium">
                      En esta zona nos encontramos en un punto céntrico. Elige uno; la hora la coordinamos por WhatsApp.
                    </legend>
                    {options.meetingPoints.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded-xl bg-papel p-3">
                        <input type="radio" name="punto" checked={meetingPoint === p.id} onChange={() => setMeetingPoint(p.id)} className="mt-1 accent-verde" />
                        <span>
                          <span className="block text-sm font-semibold">{p.name}</span>
                          {p.reference && <span className="block text-xs text-muted-foreground">{p.reference}</span>}
                        </span>
                      </label>
                    ))}
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-papel p-3">
                      <input type="radio" name="punto" checked={meetingPoint === "otro"} onChange={() => setMeetingPoint("otro")} className="mt-1 accent-verde" />
                      <span className="text-sm font-semibold">Otro punto (escríbelo)</span>
                    </label>
                    {meetingPoint === "otro" && (
                      <input aria-label="Escribe el punto de encuentro" value={meetingPointCustom} onChange={(e) => setMeetingPointCustom(e.target.value)} placeholder="Ej.: plaza principal de Ciudad Satélite…" className={field} />
                    )}
                    {err("meetingPointId") && <p className="text-sm font-medium text-rojo">{err("meetingPointId")}</p>}
                  </fieldset>
                )}
              </>
            )}

            {method === "encomienda" && (
              <>
                <p className="rounded-xl bg-papel p-3 text-sm">
                  <strong>El envío por bus se paga al recoger la encomienda (por pagar).</strong> Te pasaremos la agencia y el
                  número de guía cuando la enviemos.
                </p>
                <Field id="recipientCi" label="CI de quien recoge" error={err("recipientCi")}>
                  <input id="recipientCi" value={recipientCi} onChange={(e) => setRecipientCi(e.target.value)} placeholder="Ej.: 1234567 o 1234567-1A" autoComplete="off" className={field} {...aria("recipientCi")} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="department" label="Departamento" error={err("department")}>
                    <select id="department" value={department} onChange={(e) => setDepartment(e.target.value)} className={field} {...aria("department")}>
                      <option value="">Elige el departamento</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="city" label="Ciudad" error={err("city")}>
                    <input id="city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" className={field} {...aria("city")} />
                  </Field>
                </div>
              </>
            )}

          </section>
        )}

        <section className="grid gap-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 font-medium">
            <input type="checkbox" checked={invoiceRequested} onChange={(e) => setInvoiceRequested(e.target.checked)} className="size-5 accent-verde" />
            ¿Necesitas factura?
          </label>
          {invoiceRequested && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="invoiceNit" label="NIT o CI" error={err("invoiceNit")}>
                <input id="invoiceNit" value={invoiceNit} onChange={(e) => setInvoiceNit(e.target.value)} inputMode="numeric" autoComplete="off" className={field} {...aria("invoiceNit")} />
              </Field>
              <Field id="invoiceName" label="Razón social" error={err("invoiceName")}>
                <input id="invoiceName" value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} autoComplete="organization" className={field} {...aria("invoiceName")} />
              </Field>
            </div>
          )}
        </section>
      </div>

      <aside data-testid="checkout-summary" className="h-fit rounded-3xl bg-crema-2 p-5 md:sticky md:top-24">
        <h2 className="text-xl font-bold">Tu pedido</h2>
        {!products ? (
          <div aria-hidden className="mt-4 h-24 animate-pulse rounded-xl bg-papel" />
        ) : (
          <ul className="mt-4 grid gap-2 text-sm">
            {visible.map((l) => (
              <li key={l.productId} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {products[l.productId].name} × {l.quantity}
                </span>
                <span className="shrink-0 tabular-nums">{formatBs(products[l.productId].priceCents * l.quantity)}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatBs(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Envío</dt>
            <dd className="tabular-nums">
              {method === "encomienda" ? "Por pagar al recoger" : method === "envio_ciudad" && zone ? formatBs(fee) : method === "recojo" ? "Gratis" : "—"}
            </dd>
          </div>
          <div className="flex justify-between text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatBs(subtotal + fee)}</dd>
          </div>
        </dl>
        {formError && (
          <p role="alert" className="mt-4 rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending || lines.length === 0}>
          {pending ? "Creando tu pedido…" : "Continuar al pago"}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">En el siguiente paso verás los QR para pagar y subirás la captura.</p>
      </aside>
    </form>
  );
}
