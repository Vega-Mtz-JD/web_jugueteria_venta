import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/AuthCard";
import { SignInForm } from "@/features/auth/AuthForm";
import { safeRedirectPath } from "@/features/auth/redirect";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

async function Form({ searchParams }: { searchParams: PageProps<"/ingresar">["searchParams"] }) {
  const { siguiente } = await searchParams;
  return <SignInForm next={safeRedirectPath(typeof siguiente === "string" ? siguiente : null)} />;
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
