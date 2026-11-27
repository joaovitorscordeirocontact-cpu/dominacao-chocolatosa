"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Abaixo desta fração do tamanho original, é melhor quebrar a linha do que encolher mais. */
const COMFORT = 0.78;

/**
 * Ajusta o nome ao espaço disponível, SEMPRE exibindo o texto completo:
 *  1. cabe em uma linha no tamanho do CSS → não mexe;
 *  2. cabe em uma linha reduzindo pouco → reduz;
 *  3. senão, quebra entre palavras (reduzindo até a maior palavra caber);
 *  4. no limite legível (`min`), quebra a própria palavra. O cartão cresce.
 *
 * O tamanho máximo vem do CSS aplicado em `className`. Sem JavaScript, o texto
 * já quebra linhas normalmente.
 */
export function FitName({ children, className = "", min = 12 }: { children: string; className?: string; min?: number }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useIsoLayoutEffect(() => {
    const box = outer.current;
    const text = inner.current;
    if (!box || !text) return;
    let lastKey = "";

    const fit = (force = false) => {
      const available = box.clientWidth;
      const base = parseFloat(getComputedStyle(box).fontSize);
      const key = `${available}:${base}`;
      if (!available || (!force && key === lastKey)) return;
      lastKey = key;
      const floor = Math.min(min, base);
      const apply = (size: number) => (text.style.fontSize = size >= base ? "" : `${size / base}em`);

      // Uma linha, no tamanho original.
      apply(base);
      text.style.whiteSpace = "nowrap";
      text.style.overflowWrap = "normal";
      // Sem limite de largura durante a medição, ou tudo "pareceria" caber.
      text.style.maxWidth = "none";
      text.style.width = "max-content";
      const oneLine = text.offsetWidth;
      if (oneLine > available) {
        const shrunk = Math.floor(((base * available) / oneLine) * 10) / 10;
        if (shrunk >= Math.max(floor, base * COMFORT)) {
          apply(shrunk);
        } else {
          // Várias linhas: mede a maior palavra para não parti-la à toa.
          text.style.whiteSpace = "normal";
          text.style.width = "min-content";
          const longestWord = text.offsetWidth;
          const wordFits = Math.floor(((base * available) / longestWord) * 10) / 10;
          apply(Math.max(floor, Math.min(base, wordFits)));
        }
      }
      // Estado final: ocupa a largura do cartão e, em último caso, parte a palavra.
      const wraps = text.style.whiteSpace === "normal";
      text.style.width = "";
      text.style.maxWidth = "";
      text.style.overflowWrap = wraps ? "anywhere" : "normal";
    };

    fit(true);
    const observer = new ResizeObserver(() => fit());
    observer.observe(box);
    let alive = true;
    void document.fonts?.ready.then(() => alive && fit(true));
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [children, min]);

  return (
    <span ref={outer} className={`block w-full min-w-0 ${className}`}>
      <span ref={inner} data-fit-name="" className="inline-block max-w-full text-balance [overflow-wrap:anywhere]">
        {children}
      </span>
    </span>
  );
}
