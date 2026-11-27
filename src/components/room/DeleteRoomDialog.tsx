"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/room/api";
import { toGameError } from "@/lib/room/errors";
import { deletingHere, forgetRoom } from "@/lib/room/memory";
import type { RoomStatus } from "@/lib/room/types";

export type DeletableRoom = { roomId: string; code: string; status: RoomStatus; round: number };

const ONGOING: Partial<Record<RoomStatus, (round: number) => string>> = {
  factories: () => "A partida está sendo montada e será interrompida agora, para todos.",
  playing: (round) => `A partida está em andamento (rodada ${round}) e será interrompida agora, para todos.`,
};

/**
 * Confirmação de "Apagar sala". Só informa sucesso depois da resposta do banco;
 * em caso de falha, a sala continua na tela e dá para tentar de novo.
 */
export function DeleteRoomDialog({
  room,
  onCancel,
  onDeleted,
}: {
  room: DeletableRoom;
  onCancel: () => void;
  onDeleted: (code: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [problem, setProblem] = useState("");
  const ongoing = ONGOING[room.status]?.(room.round);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    // Ignora o segundo toque de um toque duplo no botão que abriu a janela.
    const timer = setTimeout(() => setArmed(true), 450);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (problem) cancelButton.current?.focus();
  }, [problem]);

  function cancel() {
    if (sending.current) return;
    dialog.current?.close(); // devolve o foco ao botão que abriu
    onCancel();
  }

  async function confirm() {
    if (sending.current || !armed) return;
    sending.current = true;
    // Os botões serão desativados: o foco fica na janela, para o Esc passar por aqui.
    dialog.current?.focus();
    setBusy(true);
    setProblem("");
    deletingHere.add(room.code);
    try {
      await api.deleteRoom(room.roomId);
      forgetRoom(room.roomId);
      onDeleted(room.code);
    } catch (error) {
      deletingHere.delete(room.code);
      const failure = toGameError(error);
      setProblem(
        failure.code === "network"
          ? "Sem resposta do servidor: a exclusão não foi confirmada. Confira a internet e tente de novo."
          : failure.message,
      );
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-labelledby="apagar-titulo"
      aria-describedby="apagar-aviso"
      className="panel m-auto max-h-[calc(100svh-2rem)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto bg-espresso p-5 text-center text-cream backdrop:bg-black/75"
      // Esc cancela, menos enquanto o pedido está em andamento.
      onKeyDown={(event) => {
        if (event.key === "Escape" && sending.current) event.preventDefault();
      }}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      // Se o navegador insistir em fechar durante o envio, a janela volta: o
      // resultado (ou o erro) precisa ser visto.
      onClose={() => {
        if (sending.current) dialog.current?.showModal();
      }}
    >
      <h2 id="apagar-titulo" className="gold-text text-3xl leading-tight">
        Apagar esta sala?
      </h2>
      <p className="mt-2 font-bold">
        Sala <strong className="font-display text-2xl tracking-[0.15em] text-gold">{room.code}</strong>
      </p>
      <div id="apagar-aviso">
        <p className="mt-3">
          A partida e seus dados serão removidos para todos os participantes. Esta ação não pode ser desfeita.
        </p>
        {ongoing && (
          <p className="mt-3 rounded-2xl border border-gold/60 bg-[#4a2a10] px-3 py-2 text-sm font-extrabold">
            {ongoing}
          </p>
        )}
      </div>
      {problem && (
        <p role="alert" className="mt-3 rounded-2xl border border-[#ff9d9d] bg-[#4a1214] px-3 py-2 text-sm font-bold">
          {problem}
        </p>
      )}
      <div className="mt-5 grid gap-3">
        <button ref={cancelButton} type="button" className="btn btn-ghost" autoFocus disabled={busy} onClick={cancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy}
          aria-disabled={!armed}
          onClick={() => void confirm()}
        >
          {busy ? "Apagando…" : "Apagar sala"}
        </button>
      </div>
      {busy && (
        <p role="status" className="mt-2 text-sm font-bold">
          Aguardando a confirmação do servidor…
        </p>
      )}
    </dialog>
  );
}
