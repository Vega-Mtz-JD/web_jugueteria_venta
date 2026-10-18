import type { CSSProperties, ReactNode } from "react";
import styles from "./Reveal.module.css";

/** Envuelve un bloque que aparece al cargar; `step` define el orden del escalonado. */
export function RevealItem({ children, step, className }: { children: ReactNode; step: number; className?: string }) {
  return (
    <div className={[styles.item, className].filter(Boolean).join(" ")} style={{ "--reveal-step": step } as CSSProperties}>
      {children}
    </div>
  );
}
