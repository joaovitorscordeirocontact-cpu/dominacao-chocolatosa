"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { caseDescription, caseValue } from "@/lib/room/model";
import type { CaseKind } from "@/lib/room/types";
import styles from "./briefcase.module.css";

/** Aberturas já animadas: ao mudar de fábrica ou de etapa, a tampa não "reabre". */
const animated = new Set<string>();

/** Maleta dourada. O conteúdo só existe aqui quando o banco já o revelou. */
export function Briefcase({
  number,
  content,
  revealKey,
}: {
  number: number;
  content: { kind: CaseKind; amount: number } | null;
  /** Identifica a revelação, para a tampa abrir uma única vez na tela. */
  revealKey?: string;
}) {
  const open = content !== null;
  const [fresh] = useState(() => open && revealKey !== undefined && !animated.has(revealKey));
  useEffect(() => {
    if (open && revealKey) animated.add(revealKey);
  }, [open, revealKey]);
  return (
    <div
      className={`${styles.case} ${open ? styles.open : ""}`}
      role="img"
      aria-label={
        content ? `Maleta ${number} aberta: ${caseDescription(content.kind, content.amount)}` : `Maleta ${number} fechada`
      }
    >
      <span className={styles.handle} />
      <div className={styles.body}>
        <div className={styles.inside}>
          {content && (
            <>
              <motion.span
                className={`${styles.value} ${content.kind.startsWith("loss") ? styles.negative : ""}`}
                animate={{ scale: [0.3, 1.2, 1], opacity: [0, 1, 1] }}
                transition={{ delay: 0.3, duration: 0.55 }}
              >
                {caseValue(content.kind, content.amount)}
              </motion.span>
              <span className={styles.unit}>
                {content.kind === "loss_third" ? "um terço" : content.kind === "zero" ? "nada muda" : "bombons"}
              </span>
            </>
          )}
        </div>
        <motion.div
          className={styles.lid}
          initial={fresh ? { rotateX: 0 } : false}
          animate={{ rotateX: open ? -128 : 0 }}
          transition={{ duration: 0.75, ease: [0.3, 1.25, 0.5, 1] }}
          style={{ originY: 0 }}
        >
          <div className={styles.face}>
            <span className={styles.latch} style={{ left: "17%" }} />
            <span className={styles.latch} style={{ right: "17%" }} />
            <span className={styles.plate}>{number}</span>
          </div>
          <div className={styles.back} />
        </motion.div>
      </div>
      {open && <span className={styles.tag}>nº {number}</span>}
    </div>
  );
}
