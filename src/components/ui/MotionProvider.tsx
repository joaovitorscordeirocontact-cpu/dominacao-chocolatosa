"use client";

import { MotionConfig } from "motion/react";

/** Com "reduzir movimento" ativo no sistema, Motion dispensa transformações e deslocamentos. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
