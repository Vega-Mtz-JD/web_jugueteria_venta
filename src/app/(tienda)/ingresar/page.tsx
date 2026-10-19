import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/AuthCard";
import { SignInForm } from "@/features/auth/AuthForm";
import { safeRedirectPath } from "@/features/auth/redirect";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

async function Form({ searchParams }: { searchParams: PageProps<"/ingresar">["searchParams"] }) {
  const { siguiente, error } = await searchParams;
  return (
    <>
      {error === "enlace" && (
        <p role="status" className="mb-4 rounded-lg bg-mostaza/15 px-3 py-2 text-sm font-medium">
          El enlace venció o ya se usó. Ingresa con tu contraseña o pide uno nuevo desde «¿Olvidaste tu contraseña?».
        </p>
      )}
      <SignInForm next={safeRedirectPath(typeof siguiente === "string" ? siguiente : null)} />
    </>
  );
}

export default function IngresarPage({ searchParams }: PageProps<"/ingresar">) {
  return (
    <AuthCard title="Ingresar" text="Entra con tu cuenta para comprar y ver tus pedidos.">
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
