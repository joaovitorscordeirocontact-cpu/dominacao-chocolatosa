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

    // Sem medida confiável: volta à quebra de linha normal, que nunca estoura.
    const reset = () => {
      Object.assign(text.style, { fontSize: "", whiteSpace: "", width: "", maxWidth: "", overflowWrap: "" });
      lastKey = "";
    };

    const fit = (force = false) => {
      // Dentro de um painel fechado o navegador devolve larguras que não valem.
      if (box.checkVisibility && !box.checkVisibility()) return reset();
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
      if (!oneLine) return reset();
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
    // Painéis que abrem depois nem sempre mudam a largura observada: reajusta
    // quando um <details> acima abre e quando o nome entra na tela.
    const onToggle = (event: Event) => {
      if ((event.target as Node).contains(box)) requestAnimationFrame(() => fit(true));
    };
    document.addEventListener("toggle", onToggle, true);
    const visible = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && fit(true));
    visible.observe(box);
    let alive = true;
    void document.fonts?.ready.then(() => alive && fit(true));
    return () => {
      alive = false;
      observer.disconnect();
      visible.disconnect();
      document.removeEventListener("toggle", onToggle, true);
    };
  }, [children, min]);

  return (
    // `contain: inline-size`: o nome nunca alarga o cartão. Sem isso, um nome
    // em uma linha empurraria a coluna e a medição acharia que "cabe".
    <span ref={outer} className={`block w-full min-w-0 [contain:inline-size] ${className}`}>
      <span ref={inner} data-fit-name="" className="inline-block max-w-full text-balance [overflow-wrap:anywhere]">
        {children}
      </span>
    </span>
  );
}
