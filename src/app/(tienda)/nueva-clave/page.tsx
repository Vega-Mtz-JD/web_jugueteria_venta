import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/AuthCard";
import { NewPasswordForm } from "@/features/auth/AuthForm";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default function NuevaClavePage() {
  return (
    <AuthCard title="Elige una contraseña nueva">
      <NewPasswordForm />
    </AuthCard>
  );
}
