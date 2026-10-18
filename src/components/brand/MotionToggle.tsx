"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { useState } from "react";

export const MOTION_EVENT = "ludiq:motion";

/** Las animaciones decorativas duran más de 5 s: la guía de accesibilidad pide poder pausarlas. */
export function isMotionPaused(): boolean {
  return document.documentElement.dataset.motion === "paused";
}

export function MotionToggle() {
  const [paused, setPaused] = useState(false);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    if (next) document.documentElement.dataset.motion = "paused";
    else delete document.documentElement.dataset.motion;
    window.dispatchEvent(new Event(MOTION_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={paused}
      aria-label="Pausar animaciones"
      className="inline-flex size-10 items-center justify-center rounded-full bg-crema/80 text-tinta shadow-sm backdrop-blur transition-colors hover:bg-crema focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hidden"
    >
      {paused ? <PlayIcon aria-hidden className="size-4" /> : <PauseIcon aria-hidden className="size-4" />}
    </button>
  );
}
