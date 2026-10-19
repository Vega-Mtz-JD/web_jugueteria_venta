import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/features/auth/AuthCard";
import { SignUpForm } from "@/features/auth/AuthForm";
import { safeRedirectPath } from "@/features/auth/redirect";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false } };

async function Form({ searchParams }: { searchParams: PageProps<"/registro">["searchParams"] }) {
  const { siguiente } = await searchParams;
  return <SignUpForm next={safeRedirectPath(typeof siguiente === "string" ? siguiente : null)} />;
}

export default function RegistroPage({ searchParams }: PageProps<"/registro">) {
  return (
    <AuthCard title="Crear cuenta" text="Solo te pedimos lo necesario para entregarte tu pedido.">
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
