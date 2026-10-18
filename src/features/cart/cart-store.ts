export type CartLine = { productId: string; quantity: number };

export const MAX_PER_LINE = 20;

export type CartAction =
  | { type: "add"; productId: string; quantity: number; maxStock: number }
  | { type: "setQuantity"; productId: string; quantity: number; maxStock: number }
  | { type: "remove"; productId: string }
  | { type: "clear" }
  | { type: "reconcile"; available: Record<string, number> };

const clamp = (quantity: number, maxStock: number) => Math.max(0, Math.min(Math.floor(quantity), maxStock, MAX_PER_LINE));

export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "add": {
      const current = lines.find((l) => l.productId === action.productId)?.quantity ?? 0;
      return cartReducer(lines, { ...action, type: "setQuantity", quantity: current + action.quantity });
    }
    case "setQuantity": {
      const quantity = clamp(action.quantity, action.maxStock);
      const rest = lines.filter((l) => l.productId !== action.productId);
      if (quantity === 0) return rest;
      const exists = lines.some((l) => l.productId === action.productId);
      return exists
        ? lines.map((l) => (l.productId === action.productId ? { ...l, quantity } : l))
        : [...lines, { productId: action.productId, quantity }];
    }
    case "remove":
      return lines.filter((l) => l.productId !== action.productId);
    case "clear":
      return [];
    case "reconcile":
      return lines
        .map((l) => ({ ...l, quantity: clamp(l.quantity, action.available[l.productId] ?? 0) }))
        .filter((l) => l.quantity > 0);
  }
}

// --- Almacén en localStorage (sobrevive al login y a cerrar la pestaña) ---------------
const KEY = "ludiq:carrito:v1";
const listeners = new Set<() => void>();
let memory: CartLine[] = [];
let cachedRaw: string | null | undefined;
let cachedLines: CartLine[] = [];
const EMPTY: CartLine[] = [];

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): CartLine[] {
  if (!raw) return memory;
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((l) => typeof l?.productId === "string" && Number.isInteger(l?.quantity) && l.quantity > 0)
      : [];
  } catch {
    return [];
  }
}

export function getCartSnapshot(): CartLine[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = parse(raw);
  }
  return raw === null ? memory : cachedLines;
}

export function getServerCartSnapshot(): CartLine[] {
  return EMPTY;
}

export function dispatchCart(action: CartAction): void {
  const next = cartReducer(getCartSnapshot(), action);
  memory = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Sin localStorage (modo privado estricto): el carrito vive en memoria.
  }
  listeners.forEach((l) => l());
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
