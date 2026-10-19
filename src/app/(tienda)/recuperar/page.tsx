import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/AuthCard";
import { ResetRequestForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false } };

export default function RecuperarPage() {
  return (
    <AuthCard title="Recuperar contraseña" text="Escribe tu correo y te mandamos un enlace para elegir una nueva.">
      <ResetRequestForm />
    </AuthCard>
  );
}
