import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from "./status";

const TONE = {
  neutral: "bg-tinta/10 text-tinta",
  waiting: "bg-mostaza/20 text-[#6b5210]",
  good: "bg-verde/12 text-verde",
  bad: "bg-rojo/12 text-rojo",
};

export function StatusBadge({
  status,
  labels = STATUS_LABEL,
  ...props
}: { status: OrderStatus; labels?: Record<OrderStatus, string> } & React.ComponentProps<"span">) {
  return (
    <span {...props} className={cn("inline-flex h-7 items-center rounded-full px-3 text-sm font-semibold", TONE[STATUS_TONE[status]])}>
      {labels[status]}
    </span>
  );
}
