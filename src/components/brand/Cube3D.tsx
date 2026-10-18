import type { CSSProperties } from "react";
import styles from "./Cube3D.module.css";

const COLORS = {
  r: "var(--color-cubo-rojo)",
  c: "var(--color-cubo-crema)",
  g: "var(--color-cubo-verde)",
  y: "var(--color-cubo-mostaza)",
  o: "var(--color-cubo-naranja)",
  b: "var(--color-cubo-azul)",
} as const;

// Un cubo "desarmado": cada cara mezcla colores como un Rubik a medio resolver.
const FACES: { className: string; stickers: string }[] = [
  { className: styles.front, stickers: "gcybrrorg" },
  { className: styles.back, stickers: "orocrryyr" },
  { className: styles.right, stickers: "croyrorcb" },
  { className: styles.left, stickers: "borooyrcr" },
  { className: styles.top, stickers: "ocgycorog" },
  { className: styles.bottom, stickers: "obcroobcg" },
];

export function Cube3D({ size = 130 }: { size?: number }) {
  return (
    <div className={styles.scene} aria-hidden>
      <div data-testid="cube3d" className={styles.cube} style={{ "--size": `${size}px` } as CSSProperties}>
        {FACES.map((face, i) => (
          <div key={i} className={`${styles.face} ${face.className}`}>
            {[...face.stickers].map((key, j) => (
              <i key={j} style={{ background: COLORS[key as keyof typeof COLORS] }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
