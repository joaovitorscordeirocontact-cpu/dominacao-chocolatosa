"use client";

import { motion } from "motion/react";
import { caseResult, signed } from "@/lib/stage";
import styles from "./briefcase.module.css";

export function Briefcase({ number, open }: { number: number; open: boolean }) {
  const value = caseResult(number);
  return (
    <div
      className={`${styles.case} ${open ? styles.open : ""}`}
      role="img"
      aria-label={open ? `Maleta ${number} aberta: ${signed(value)} pontos fictícios` : `Maleta ${number} fechada`}
    >
      <span className={styles.handle} />
      <div className={styles.body}>
        <div className={styles.inside}>
          {open && (
            <>
              <motion.span
                className={`${styles.value} ${value < 0 ? styles.negative : ""}`}
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: [0.3, 1.2, 1], opacity: [0, 1, 1] }}
                transition={{ delay: 0.3, duration: 0.55 }}
              >
                {signed(value)}
              </motion.span>
              <span className={styles.unit}>pts fictícios</span>
            </>
          )}
        </div>
        <motion.div
          className={styles.lid}
          // `initial={false}`: ao trocar de fábrica, a maleta já aberta continua aberta.
          initial={false}
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
