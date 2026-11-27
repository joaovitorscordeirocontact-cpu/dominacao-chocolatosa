"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";

const VIEWS = [
  { href: "/lobby", label: "Participante / capitão", hint: "Tela de celular", paths: ["/lobby", "/palco"] },
  { href: "/moderador", label: "Moderador", hint: "Comandos da rodada", paths: ["/moderador"] },
  { href: "/telao", label: "Telão", hint: "Imagem grande para a sala", paths: ["/telao"] },
];

/** Alternância discreta de perspectivas (recurso exclusivo da demonstração). */
export function PerspectiveSwitcher() {
  const pathname = usePathname();
  const id = useId();

  return (
    <>
      <button type="button" popoverTarget={id} className="btn btn-ghost min-h-11! border-dashed! px-4! py-1! text-xs">
        Demo · trocar visão
      </button>
      <div
        id={id}
        popover="auto"
        className="demo-box m-auto w-[min(92vw,22rem)] bg-espresso! p-4 text-cream backdrop:bg-black/70"
      >
        <p className="demo-label">Perspectivas da demonstração</p>
        <ul className="mt-3 grid gap-2">
          {VIEWS.map((view) => {
            const current = view.paths.includes(pathname);
            return (
              <li key={view.href}>
                <Link
                  href={view.href}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-14 flex-col justify-center rounded-xl border-2 px-3 ${
                    current ? "border-gold bg-gold/20" : "border-cream/20"
                  }`}
                >
                  <span className="font-black">{view.label}</span>
                  <span className="text-xs text-cream/75">{view.hint}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <a href="/telao" target="_blank" rel="noopener" className="btn btn-ghost mt-3 w-full text-sm">
          Abrir telão em outra janela ↗
        </a>
        <p className="mt-3 text-xs leading-snug text-cream/75">
          Os dados ficam neste navegador. Janelas dele acompanham umas às outras, mas não há conexão com outros
          celulares ou computadores.
        </p>
        <button type="button" popoverTarget={id} popoverTargetAction="hide" className="btn btn-gold mt-3 w-full">
          Fechar
        </button>
      </div>
    </>
  );
}
