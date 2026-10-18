"use client";

import { MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] as const } },
};

/** La única animación de entrada de la página: el texto de la portada aparece escalonado. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div className={className} variants={container} initial="hidden" animate="show">
        {children}
      </motion.div>
    </MotionConfig>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
