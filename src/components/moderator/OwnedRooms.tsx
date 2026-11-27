"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DeleteRoomDialog } from "@/components/room/DeleteRoomDialog";
import { NotConfigured } from "@/components/room/RoomGate";
import { Screen } from "@/components/ui/Screen";
import { api, type OwnedRoom } from "@/lib/room/api";
import { toGameError } from "@/lib/room/errors";
import { roomPath } from "@/lib/room/links";
import { deletingHere, justDeleted } from "@/lib/room/memory";
import { isConfigured, storedUserId } from "@/lib/supabase/client";

function statusText({ status, round }: OwnedRoom) {
  if (status === "lobby") return "No lobby";
  if (status === "factories") return "Montando as fábricas";
  if (status === "playing") return `Em andamento · rodada ${round}`;
  return "Partida encerrada";
}

const created = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Salas criadas por este aparelho, com retomada e exclusão. */
export function OwnedRooms() {
  /** `null` enquanto o banco não respondeu: nunca mostra "vazio" sem saber. */
  const [rooms, setRooms] = useState<OwnedRoom[] | null>(null);
  const [problem, setProblem] = useState("");
  const [target, setTarget] = useState<OwnedRoom | null>(null);
  const [removed, setRemoved] = useState(() => justDeleted.code);

  const load = useCallback(async () => {
    try {
      const list = (await storedUserId()) ? await api.ownedRooms() : [];
      setRooms(list);
      setProblem("");
    } catch (error) {
      // A lista anterior continua na tela: falha de rede não "apaga" nada.
      setProblem(toGameError(error).message);
    }
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    deletingHere.delete(justDeleted.code);
    justDeleted.code = "";
    const wake = () => {
      if (document.visibilityState === "visible") void load();
    };
    wake();
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [load]);

  if (!isConfigured) return <NotConfigured />;

  return (
    <Screen title="Minhas salas" backHref="/" backLabel="Início">
      <div className="mx-auto grid max-w-md gap-3">
        <p role="status" className={removed ? "rounded-2xl border-2 border-gold bg-gold/15 p-3 text-center font-bold" : "sr-only"}>
          {removed && `Sala ${removed} apagada.`}
        </p>
        {problem && (
          <div role="alert" className="rounded-2xl border border-[#ff9d9d] bg-[#4a1214] p-3 text-center text-sm font-bold">
            <p>{problem}</p>
            <button type="button" className="btn btn-ghost mt-2 min-h-11! text-sm" onClick={() => void load()}>
              Tentar de novo
            </button>
          </div>
        )}
        {rooms === null && !problem && (
          <p role="status" className="py-8 text-center font-bold">
            Carregando suas salas…
          </p>
        )}
        {rooms?.length === 0 && (
          <p className="panel p-5 text-center font-bold">Nenhuma sala criada neste aparelho.</p>
        )}
        {rooms && rooms.length > 0 && (
          <ul className="grid gap-3">
            {rooms.map((room) => (
              <li key={room.roomId} className="panel p-4 text-center" data-testid="owned-room">
                <h2 className="font-display text-3xl tracking-[0.18em] text-gold">{room.code}</h2>
                <p className="mt-1 font-extrabold">{statusText(room)}</p>
                <p className="text-sm text-cream/80">
                  {room.players} {room.players === 1 ? "participante" : "participantes"} · criada em{" "}
                  {created.format(new Date(room.createdAt))}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Link
                    href={roomPath("moderator", room.code)}
                    className="btn btn-gold text-sm"
                    aria-label={`Abrir a sala ${room.code}`}
                  >
                    Abrir
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost text-sm"
                    aria-label={`Apagar sala ${room.code}`}
                    onClick={() => {
                      setRemoved("");
                      setTarget(room);
                    }}
                  >
                    Apagar sala
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-center text-xs text-cream/70">
          A moderação fica neste navegador: limpar os dados dele faz perder o acesso a estas salas.
        </p>
      </div>
      {target && (
        <DeleteRoomDialog
          key={target.roomId}
          room={target}
          onCancel={() => setTarget(null)}
          onDeleted={(code) => {
            deletingHere.delete(code);
            setRooms((list) => list?.filter((room) => room.code !== code) ?? null);
            setTarget(null);
            setRemoved(code);
            void load();
          }}
        />
      )}
    </Screen>
  );
}
