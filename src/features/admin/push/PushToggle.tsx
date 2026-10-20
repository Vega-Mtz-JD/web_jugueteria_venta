"use client";

import { BellIcon, BellOffIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { callAction, NETWORK_ERROR } from "../call-action";
import { removeSubscriptionAction, saveSubscriptionAction, sendTestPushAction } from "./push-actions";
import { urlBase64ToUint8Array } from "./vapid";

type State = "cargando" | "no-soportado" | "bloqueado" | "apagado" | "activado";

const SW_URL = "/panel-sw.js";
const SCOPE = "/panel";

function supported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(SCOPE);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Activar los avisos de pedidos en este celular o PC (cada dispositivo se activa por separado). */
export function PushToggle() {
  const [state, setState] = useState<State>("cargando");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (!supported()) next = "no-soportado";
      else if (Notification.permission === "denied") next = "bloqueado";
      else next = Notification.permission === "granted" && (await currentSubscription().catch(() => null)) ? "activado" : "apagado";
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function activate() {
    setMessage(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "bloqueado" : "apagado");
          return;
        }
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: SCOPE });
        await navigator.serviceWorker.ready;
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
        const json = sub.toJSON();
        const result = await callAction(() =>
          saveSubscriptionAction({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", userAgent: navigator.userAgent.slice(0, 300) }),
        );
        if ("error" in result) {
          setMessage({ ok: false, text: result.error });
          return;
        }
        setState("activado");
      } catch {
        setMessage({ ok: false, text: NETWORK_ERROR });
      }
    });
  }

  function deactivate() {
    setMessage(null);
    startTransition(async () => {
      const sub = await currentSubscription().catch(() => null);
      if (sub) {
        const result = await callAction(() => removeSubscriptionAction(sub.endpoint));
        if ("error" in result) {
          setMessage({ ok: false, text: result.error });
          return;
        }
        await sub.unsubscribe().catch(() => false);
      }
      setState("apagado");
    });
  }

  function test() {
    setMessage(null);
    startTransition(async () => {
      const result = await callAction(() => sendTestPushAction());
      setMessage("error" in result ? { ok: false, text: result.error } : { ok: true, text: "Enviamos un aviso de prueba" });
    });
  }

  return (
    <section aria-labelledby="avisos-titulo" className="rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6">
      <h2 id="avisos-titulo" className="flex items-center gap-2 font-serif text-xl font-bold">
        <BellIcon aria-hidden className="size-5 text-verde" />
        Avisos en este dispositivo
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Suena cuando un comprador sube la captura de su pago. Actívalo en cada celular o PC donde quieras recibirlo.</p>
      <div className="mt-4 grid gap-3">
        {state === "no-soportado" && <p>Este navegador no permite avisos. En iPhone, primero instala el panel en la pantalla de inicio.</p>}
        {state === "bloqueado" && <p>Los avisos están bloqueados. Actívalos en los ajustes del navegador para este sitio.</p>}
        {state === "apagado" && (
          <Button className="justify-self-start" disabled={pending} onClick={activate}>
            <BellIcon data-icon="inline-start" />
            {pending ? "Activando…" : "Activar avisos"}
          </Button>
        )}
        {state === "activado" && (
          <>
            <p className="font-semibold text-verde">Avisos activados en este dispositivo</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={pending} onClick={test}>
                Enviar aviso de prueba
              </Button>
              <Button variant="ghost" disabled={pending} onClick={deactivate}>
                <BellOffIcon data-icon="inline-start" />
                Desactivar
              </Button>
            </div>
          </>
        )}
        {message && (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm font-medium text-verde" : "text-sm font-medium text-rojo"}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
