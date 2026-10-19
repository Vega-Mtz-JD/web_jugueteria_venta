"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthState } from "./actions";

const field =
  "h-11 w-full rounded-lg border border-input bg-papel px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function Field(props: { label: string; name: string; type?: string; autoComplete: string; required?: boolean; hint?: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {props.label}
      <input
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        required={props.required ?? true}
        spellCheck={props.type === "email" ? false : undefined}
        className={field}
      />
      {props.hint && <span className="text-xs font-normal text-muted-foreground">{props.hint}</span>}
    </label>
  );
}

function Feedback({ state }: { state: AuthState }) {
  return (
    <div aria-live="polite">
      {state.error && <p className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{state.error}</p>}
      {state.message && <p className="rounded-lg bg-verde/10 px-3 py-2 text-sm font-medium text-verde">{state.message}</p>}
    </div>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="siguiente" value={next} />
      <Field label="Correo" name="email" type="email" autoComplete="email" />
      <Field label="Contraseña" name="password" type="password" autoComplete="current-password" />
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
      <p className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/recuperar" className="text-verde underline-offset-4 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href={`/registro?siguiente=${encodeURIComponent(next)}`} className="font-semibold text-verde underline-offset-4 hover:underline">
          Crear una cuenta
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, {});
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="siguiente" value={next} />
      <Field label="Nombre completo" name="fullName" autoComplete="name" />
      <Field label="Correo" name="email" type="email" autoComplete="email" />
      <Field label="Contraseña" name="password" type="password" autoComplete="new-password" hint="Al menos 8 caracteres" />
      <Field label="Celular (opcional)" name="phone" type="tel" autoComplete="tel" required={false} hint="Para coordinar la entrega por WhatsApp" />
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creando tu cuenta…" : "Crear cuenta"}
      </Button>
      <p className="text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href={`/ingresar?siguiente=${encodeURIComponent(next)}`} className="font-semibold text-verde underline-offset-4 hover:underline">
          Ingresa aquí
        </Link>
      </p>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  return (
    <form action={action} className="grid gap-4">
      <Field label="Correo" name="email" type="email" autoComplete="email" />
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  return (
    <form action={action} className="grid gap-4">
      <Field label="Nueva contraseña" name="password" type="password" autoComplete="new-password" hint="Al menos 8 caracteres" />
      <Feedback state={state} />
      {state.message ? (
        <Button asChild size="lg">
          <Link href="/catalogo">Ir al catálogo</Link>
        </Button>
      ) : (
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando…" : "Guardar contraseña"}
        </Button>
      )}
    </form>
  );
}
