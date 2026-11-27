"use client";

import Link from "next/link";
import { ChocolateWave } from "@/components/ui/ChocolateWave";
import { useDemoState } from "@/lib/store";
import { AtmosferaToggle } from "./AtmosferaToggle";
import styles from "./opening.module.css";

function Art() {
  // Recortes SEM texto da referência (gerados por scripts/preparar-assets.py).
  /* eslint-disable @next/next/no-img-element */
  return (
    <div className={styles.art} aria-hidden="true">
      <img className={styles.base} src="/assets/abertura/base-centro.webp" alt="" width={830} height={171} />
      <img className={styles.left} src="/assets/abertura/lado-esquerdo.webp" alt="" width={560} height={736} fetchPriority="high" />
      <img className={styles.right} src="/assets/abertura/lado-direito.webp" alt="" width={570} height={736} fetchPriority="high" />
      <img className={styles.top} src="/assets/abertura/topo.webp" alt="" width={1672} height={270} />
      <ChocolateWave className={styles.wave} />
    </div>
  );
}

export function OpeningScene() {
  const { settings } = useDemoState();

  return (
    <main className={styles.screen}>
      <Art />
      <AtmosferaToggle className={styles.option} />
      <div className={styles.content}>
        {settings.showAtmosfera && <p className={styles.atmosfera}>Atmosfera Jovem</p>}
        <h1 className={styles.title} aria-label="Dominação Chocolatosa">
          <span className={styles.word} data-text="Dominação" aria-hidden="true">
            <span>Dominação</span>
          </span>
          <span className={styles.word} data-text="Chocolatosa" aria-hidden="true">
            <span>Chocolatosa</span>
          </span>
        </h1>
        <p className={styles.subtitle}>Topa ou Arrisca?</p>
        <div className={styles.actions}>
          <Link href="/personagem" className={`btn btn-primary ${styles.play}`}>
            Entrar no jogo <span aria-hidden="true">→</span>
          </Link>
          <Link href="/moderador" className="btn btn-ghost text-sm">
            Demonstração da moderação
          </Link>
        </div>
      </div>
    </main>
  );
}
