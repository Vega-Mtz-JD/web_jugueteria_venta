import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRightIcon } from "lucide-react";
import { DebtText } from "@/features/admin/purchases/DebtText";
import { listSuppliers } from "@/features/admin/purchases/queries";
import { NewSupplierForm } from "@/features/admin/purchases/SupplierForm";

export const metadata: Metadata = { title: "Proveedores" };

async function Suppliers({ searchParams }: { searchParams: PageProps<"/panel/proveedores">["searchParams"] }) {
  const [suppliers, sp] = await Promise.all([listSuppliers(), searchParams]);
  return (
    <>
      {sp.borrado === "1" && (
        <p role="status" className="mb-4 rounded-xl bg-verde/10 px-4 py-3 font-medium text-verde">
          Proveedor borrado
        </p>
      )}
      {suppliers.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-input bg-papel px-6 py-10 text-center text-muted-foreground">Todavía no hay proveedores.</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {suppliers.map((s) => (
            <li key={s.id}>
              <Link href={`/panel/proveedores/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-[#eadcc4] bg-papel p-4 hover:border-madera">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {s.name}
                    {!s.isActive && <span className="ml-2 rounded-full bg-tinta/10 px-2 py-0.5 text-xs font-semibold">Inactivo</span>}
                  </span>
                  <span className="block text-sm">
                    {s.contactName && <span className="text-muted-foreground">{s.contactName} · </span>}
                    <DebtText debt={s.debt} />
                  </span>
                </span>
                <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ProveedoresPage(props: PageProps<"/panel/proveedores">) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-3xl font-extrabold tracking-tight">Proveedores</h1>
      <NewSupplierForm />
      <Suspense fallback={<div aria-hidden className="h-48 animate-pulse rounded-3xl bg-crema-2" />}>
        <Suppliers searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
