const STICKERS = [
  "bg-cubo-rojo",
  "bg-cubo-crema",
  "bg-cubo-verde",
  "bg-cubo-mostaza",
  "bg-cubo-rojo",
  "bg-cubo-azul",
  "bg-cubo-naranja",
  "bg-cubo-verde",
  "bg-cubo-crema",
];

export function Logo({ storeName }: { storeName: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-serif text-[1.375rem] font-extrabold leading-none tracking-tight">
      <span aria-hidden className="grid grid-cols-3 gap-[1.5px] rounded-[3px] bg-tinta p-[2px]">
        {STICKERS.map((color, i) => (
          <i key={i} className={`block size-1.5 rounded-[1px] ${color}`} />
        ))}
      </span>
      {storeName}
    </span>
  );
}
