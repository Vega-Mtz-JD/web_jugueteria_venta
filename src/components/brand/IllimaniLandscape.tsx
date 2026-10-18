"use client";

import { useReducedMotion } from "motion/react";

// Cabinas del teleférico: colores de las líneas Roja, Amarilla y Verde.
const CABINS = [
  { color: "var(--color-cubo-rojo)", begin: "0s", still: 0.18 },
  { color: "var(--color-cubo-mostaza)", begin: "-11s", still: 0.66 },
  { color: "var(--color-cubo-verde)", begin: "-5.5s", still: 0.42 },
];
const CABLE = { x1: 90, y1: 300, x2: 1110, y2: 185 };

function Cabin({ color }: { color: string }) {
  return (
    <>
      <line x1="0" y1="0" x2="0" y2="8" stroke="#6b5641" strokeWidth="1.5" />
      <rect x="-11" y="8" width="22" height="16" rx="4" fill={color} />
      <rect x="-7" y="11" width="14" height="6" rx="1.5" fill="#fbe9d0" />
    </>
  );
}

/**
 * Silueta del Illimani al atardecer con las laderas de La Paz y el teleférico.
 * Ilustración provisional: se reemplazará por fotos reales (spec 5.8).
 */
export function IllimaniLandscape() {
  // Las animaciones SVG (animateMotion) no obedecen a la regla CSS de movimiento reducido.
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 1200 320" preserveAspectRatio="xMidYMax slice" aria-hidden className="size-full">
      <defs>
        <linearGradient id="illimani-roca" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9a2bd" />
          <stop offset="1" stopColor="#cfc3c4" />
        </linearGradient>
        <pattern id="illimani-ventanas" width="14" height="10" patternUnits="userSpaceOnUse">
          <rect x="2" y="2" width="5" height="4" rx="1" fill="#b98f62" opacity=".55" />
        </pattern>
      </defs>
      <path
        fill="url(#illimani-roca)"
        d="M0 260 L80 240 L160 245 L240 215 L320 225 L420 170 L480 150 L530 120 L560 128 L600 95 L640 108 L680 80 L720 92 L760 70 L800 88 L850 110 L900 140 L960 175 L1040 200 L1120 220 L1200 230 L1200 320 L0 320 Z"
      />
      <path
        fill="#fbf7ef"
        d="M470 152 L530 120 L560 128 L600 95 L640 108 L680 80 L720 92 L760 70 L800 88 L850 110 L885 130 L850 133 L820 121 L795 140 L770 121 L745 142 L715 118 L690 137 L660 120 L635 142 L610 122 L585 147 L560 135 L535 154 L505 148 Z"
      />
      <path fill="#e2cfae" d="M0 292 Q150 248 320 272 T650 262 T1000 268 T1200 250 L1200 320 L0 320 Z" />
      <path fill="url(#illimani-ventanas)" d="M0 300 Q150 262 320 284 T650 276 T1000 280 T1200 266 L1200 320 L0 320 Z" />
      <path fill="#d6bf98" d="M0 312 Q300 290 600 304 T1200 296 L1200 320 L0 320 Z" />
      <path
        id="illimani-cable"
        d={`M${CABLE.x1} ${CABLE.y1} L${CABLE.x2} ${CABLE.y2}`}
        stroke="#6b5641"
        strokeWidth="1.6"
        fill="none"
        opacity=".7"
      />
      {CABINS.map((cabin) =>
        reduce ? (
          <g
            key={cabin.color}
            transform={`translate(${CABLE.x1 + (CABLE.x2 - CABLE.x1) * cabin.still} ${CABLE.y1 + (CABLE.y2 - CABLE.y1) * cabin.still})`}
          >
            <Cabin color={cabin.color} />
          </g>
        ) : (
          <g key={cabin.color}>
            <animateMotion dur="22s" begin={cabin.begin} repeatCount="indefinite">
              <mpath href="#illimani-cable" />
            </animateMotion>
            <Cabin color={cabin.color} />
          </g>
        ),
      )}
    </svg>
  );
}
