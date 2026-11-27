"use client";

import type { Commands } from "@/lib/room/useCommand";
import type { Room } from "@/lib/room/useRoom";

/** Estado da ligação com o servidor, sempre visível quando algo não vai bem. */
export function ConnectionBadge({ room }: { room: Pick<Room, "online" | "connection" | "problem"> }) {
  const state = !room.online
    ? { dot: "bg-[#ff6b6b]", text: "Sem internet" }
    : room.connection === "live"
      ? { dot: "bg-[#5fd584]", text: "Ao vivo" }
      : room.connection === "connecting"
        ? { dot: "bg-gold", text: "Conectando…" }
        : { dot: "bg-gold", text: "Reconectando…" };
  return (
    <span
      role="status"
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-cream/20 bg-espresso/85 px-3 py-1 text-xs font-extrabold"
    >
      <span aria-hidden="true" className={`size-2.5 rounded-full ${state.dot}`} />
      {state.text}
    </span>
  );
}

export function ConnectionWarning({ room }: { room: Pick<Room, "online" | "connection" | "problem"> }) {
  if (room.online && !room.problem) return null;
  return (
    <p role="alert" className="mb-3 rounded-2xl border border-gold/60 bg-[#4a2a10] px-4 py-3 text-sm font-bold">
      {room.online ? room.problem : "Você está sem internet."} A tela mostra o último estado recebido.
    </p>
  );
}

/** Ação em envio ou recusada. Fica fixa para ser vista em qualquer rolagem. */
export function CommandFeedback({ commands }: { commands: Pick<Commands, "pending" | "error" | "clearError"> }) {
  const { pending, error, clearError } = commands;
  if (!pending && !error) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex justify-center px-3">
      {pending ? (
        <p role="status" className="flex items-center gap-2 rounded-full border-2 border-gold bg-espresso px-4 py-2 text-sm font-extrabold shadow-panel">
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          Enviando… aguarde a confirmação
        </p>
      ) : (
        <div
          role="alert"
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border-2 border-[#ff9d9d] bg-[#4a1214] py-2 pr-2 pl-4 text-sm font-bold shadow-panel"
        >
          <span>{error!.message}</span>
          <button type="button" className="btn btn-ghost min-h-11! shrink-0 px-3! py-1! text-xs" onClick={clearError}>
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
