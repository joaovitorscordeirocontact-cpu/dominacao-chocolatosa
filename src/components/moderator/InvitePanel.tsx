"use client";

import { useState, useSyncExternalStore } from "react";
import { renderSVG } from "uqr";
import { shareUrl } from "@/lib/room/links";
import type { Snapshot } from "@/lib/room/types";
import type { Commands } from "@/lib/room/useCommand";

const never = () => () => {};
export const useOrigin = () => useSyncExternalStore(never, () => window.location.origin, () => "");

/** QR code gerado no próprio aparelho: o link não é enviado a nenhum serviço. */
export function InviteQr({ url, className = "" }: { url: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label="QR code do convite da sala"
      className={`overflow-hidden rounded-2xl bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: renderSVG(url, { border: 2, ecc: "M" }) }}
    />
  );
}

export function InvitePanel({ snapshot, commands }: { snapshot: Snapshot; commands: Commands }) {
  const origin = useOrigin();
  const [copied, setCopied] = useState("");
  const { code, entriesOpen, status } = snapshot.room;
  if (!origin) return null;
  const invite = shareUrl(origin, "entrar", code);
  const screen = shareUrl(origin, "telao", code);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${label} copiado.`);
    } catch {
      setCopied("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <div className="grid gap-3 text-center">
      <p className="text-sm font-bold">Código da sala</p>
      <p className="font-display text-5xl tracking-[0.2em] text-gold" data-testid="room-code">
        {code}
      </p>
      <InviteQr url={invite} className="mx-auto w-full max-w-56" />
      <p className="text-xs break-all text-cream/80 select-all" data-testid="invite-url">
        {invite}
      </p>
      <button type="button" className="btn btn-gold text-sm" onClick={() => void copy(invite, "Convite")}>
        Copiar convite
      </button>
      {status !== "ended" && (
        <button
          type="button"
          className="btn btn-ghost text-sm"
          disabled={commands.pending !== null}
          aria-pressed={entriesOpen}
          onClick={() => void commands.run("set_entries", { open: !entriesOpen })}
        >
          {entriesOpen ? "Entradas abertas · tocar para fechar" : "Entradas fechadas · tocar para reabrir"}
        </button>
      )}
      <div className="border-t border-cream/15 pt-3">
        <p className="text-sm font-black">Telão (somente leitura)</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a href={screen} target="_blank" rel="noreferrer" className="btn btn-ghost text-sm">
            Abrir
          </a>
          <button type="button" className="btn btn-ghost text-sm" onClick={() => void copy(screen, "Link do telão")}>
            Copiar link
          </button>
        </div>
      </div>
      <p role="status" className="min-h-5 text-xs font-bold text-gold">
        {copied}
      </p>
    </div>
  );
}
