"use client";

import { useEffect, useState } from "react";
import { Briefcase } from "@/components/stage/Briefcase";
import { CaseBoard } from "@/components/stage/CaseBoard";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { api } from "@/lib/room/api";
import { toGameError } from "@/lib/room/errors";
import { caseDescription, type TeamView } from "@/lib/room/model";
import type { Snapshot, SpyRecord } from "@/lib/room/types";

/**
 * Espionagem azul da liderança. O conteúdo só chega por pedido da própria
 * pessoa autorizada (nunca no estado compartilhado) e fica oculto até ela tocar
 * em "mostrar", para ninguém ler por cima do ombro.
 */
export function SpyPanel({
  snapshot,
  teams,
  refresh,
}: {
  snapshot: Snapshot;
  teams: TeamView[];
  refresh: () => Promise<void>;
}) {
  const roomId = snapshot.room.id;
  const grant = snapshot.spy.find((item) => item.teamId === snapshot.me.teamId)?.status;
  const authorized = grant === "active" && snapshot.room.stage === "preparation";
  const [records, setRecords] = useState<SpyRecord[]>([]);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");

  // Recupera consultas já feitas (inclusive após recarregar a página).
  useEffect(() => {
    let alive = true;
    api
      .mySpies(roomId)
      .then((list) => alive && setRecords(list))
      .catch((error) => alive && setProblem(toGameError(error).message));
    return () => {
      alive = false;
    };
  }, [roomId, snapshot.room.round, grant]);

  async function peek(number: number) {
    setSending(true);
    setProblem("");
    try {
      const result = await api.spy(roomId, number);
      setRecords((list) => [
        ...list.filter((item) => !(item.round === snapshot.room.round && item.number === number)),
        { ...result, round: snapshot.room.round },
      ]);
      setRevealed(result.number);
      setSelected(null);
    } catch (error) {
      // Pedir a mesma maleta de novo devolve a mesma consulta, sem gastar outra.
      setProblem(toGameError(error).message);
    } finally {
      setSending(false);
      void refresh();
    }
  }

  // Consultas ainda úteis: maletas que continuam fechadas.
  const useful = records.filter((record) => snapshot.cases[record.number - 1]?.state !== "opened");
  if (!authorized && useful.length === 0) {
    return problem ? <p role="alert" className="mt-3 text-sm font-bold text-blush">{problem}</p> : null;
  }

  return (
    <section className="mt-4 rounded-3xl border-2 border-[#5aa9ff] bg-[#0d2547]/80 p-4" aria-labelledby="espionagem">
      <h2 id="espionagem" className="text-lg font-black">
        Espionagem industrial · só você vê
      </h2>

      {useful.length > 0 && (
        <ul className="mt-3 grid gap-3">
          {useful.map((record) => (
            <li key={`${record.round}-${record.number}`} className="rounded-2xl bg-espresso/80 p-3 text-center">
              {revealed === record.number ? (
                <>
                  <div className="mx-auto w-40">
                    <Briefcase number={record.number} content={record} revealKey={`espiada-${roomId}-${record.number}`} />
                  </div>
                  <p className="mt-2 font-bold" role="status">
                    Maleta {record.number}: {caseDescription(record.kind, record.amount)}
                  </p>
                  <button type="button" className="btn btn-ghost mt-2 min-h-11! text-sm" onClick={() => setRevealed(null)}>
                    Ocultar
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-ghost w-full text-sm" onClick={() => setRevealed(record.number)}>
                  Mostrar o que há na maleta {record.number}
                </button>
              )}
              <p className="mt-1 text-xs text-cream/70">Vista na rodada {record.round}</p>
            </li>
          ))}
        </ul>
      )}

      {authorized && (
        <>
          <p className="mt-2 text-sm">
            Autorização liberada. Escolha <strong>uma</strong> maleta para espiar. Isso não a reserva.
          </p>
          <div className="mt-3">
            <CaseBoard snapshot={snapshot} teams={teams} selected={selected} disabled={sending} onSelect={setSelected} />
          </div>
          <div className="mt-4">
            {selected !== null && (
              <ConfirmButton
                key={selected}
                className="btn btn-gold w-full"
                confirmLabel={`Confirmar: gastar a espionagem na maleta ${selected}`}
                disabled={sending}
                onConfirm={() => void peek(selected)}
              >
                {sending ? "Consultando…" : `Espiar a maleta ${selected}`}
              </ConfirmButton>
            )}
          </div>
        </>
      )}
      {problem && (
        <p role="alert" className="mt-3 text-sm font-bold text-blush">
          {problem}
        </p>
      )}
    </section>
  );
}
