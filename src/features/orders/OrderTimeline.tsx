import { STATUS_LABEL, type OrderStatus } from "./status";

const when = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" });

export function OrderTimeline({
  events,
  labels = STATUS_LABEL,
}: {
  events: { toStatus: OrderStatus; note: string | null; createdAt: string }[];
  labels?: Record<OrderStatus, string>;
}) {
  return (
    <ol className="grid gap-3 border-l-2 border-[#eadcc4] pl-4">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span aria-hidden className="absolute -left-[1.4rem] top-1.5 size-3 rounded-full border-2 border-papel bg-verde" />
          <p className="font-semibold">{labels[e.toStatus]}</p>
          <p className="text-sm text-muted-foreground">
            {when.format(new Date(e.createdAt))}
            {e.note && <> · {e.note}</>}
          </p>
        </li>
      ))}
    </ol>
  );
}
