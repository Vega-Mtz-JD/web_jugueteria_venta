import type { ReactNode } from "react";

export function AuthCard({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-3xl border border-[#eadcc4] bg-papel p-6 shadow-[0_22px_40px_-28px_rgb(43_33_24/0.45)] sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {text && <p className="mt-2 text-muted-foreground">{text}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
