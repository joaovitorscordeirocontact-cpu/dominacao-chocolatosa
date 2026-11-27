"use client";

import { useState } from "react";
import { AtmosferaToggle } from "@/components/home/AtmosferaToggle";
import { Avatar } from "@/components/mascot/Avatar";
import { DemoControls } from "@/components/stage/DemoControls";
import { Duel } from "@/components/stage/Duel";
import { canStartBattle, endBattle, startBattle } from "@/lib/battle";
import { TEAM_COLORS } from "@/lib/catalog";
import { createDefaultState } from "@/lib/demo-state";
import { buildTeams } from "@/lib/mock-data";
import { updateDemo, useDemoState, useHydrated } from "@/lib/store";

const participations = (count: number) => `${count} ${count === 1 ? "participação" : "participações"}`;

export function ModeratorPanel() {
  const state = useDemoState();
  const hydrated = useHydrated();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const teams = buildTeams(state);
  const { battle, stage } = state;

  if (!hydrated) return <p className="py-10 text-center font-bold">Carregando…</p>;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div className="grid grid-cols-1 gap-4">
        <section className="panel p-4" aria-labelledby="batalha-titulo">
          <h2 id="batalha-titulo" className="text-xl font-black">
            1. Batalha pelas cartas
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2">
            {teams.map((team) => {
              const representative = team.participants.find((p) => p.id === battle.representatives[team.id]);
              const confirmed = battle.confirmed[team.id];
              return (
                <li
                  key={team.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-l-8 bg-espresso/60 p-2"
                  style={{ borderColor: TEAM_COLORS[team.id] }}
                >
                  {representative ? (
                    <Avatar look={representative} className="size-12" />
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-dashed border-cream/40 font-black">
                      ?
                    </span>
                  )}
                  <span className="min-w-0 flex-1 basis-32">
                    <strong className="block leading-tight break-words">{team.name}</strong>
                    <span className="block text-sm leading-snug text-cream/80">
                      {representative
                        ? `${representative.name} · ${participations(state.participation[representative.id] ?? 0)}`
                        : "Sem representante"}
                    </span>
                  </span>
                  <span
                    className={`ml-auto shrink-0 rounded-full px-2 py-1 text-xs font-black ${
                      confirmed ? "bg-[#5fd584] text-espresso" : "bg-cream/15"
                    }`}
                  >
                    {battle.started ? "Na batalha" : confirmed ? "✓ Confirmado" : "Aguardando"}
                  </span>
                </li>
              );
            })}
          </ul>
          {battle.started ? (
            <button type="button" className="btn btn-ghost mt-4 min-h-14! w-full text-lg" onClick={() => updateDemo(endBattle)}>
              Encerrar batalha e liberar nova escolha
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary mt-4 min-h-14! w-full text-lg"
                disabled={!canStartBattle(state)}
                onClick={() => updateDemo(startBattle)}
              >
                Confirmar início da batalha
              </button>
              {!canStartBattle(state) && (
                <p className="mt-3 text-center text-sm font-bold text-blush">
                  Falta o capitão de {teams[0].name} confirmar o representante no lobby.
                </p>
              )}
            </>
          )}
        </section>

        <section className="panel p-4" aria-labelledby="maletas-titulo">
          <h2 id="maletas-titulo" className="text-xl font-black">
            2. Maletas <span className="text-sm font-bold text-blush">(demonstração visual)</span>
          </h2>
          <p className="mt-1 mb-4 text-sm text-cream/80">
            {stage.view === "confronto"
              ? stage.revealed
                ? "Maletas abertas. Teste inversão, coringa e bônus."
                : "Confronto montado. Abra quando quiser."
              : `${Object.values(stage.picks).filter(Boolean).length} de 4 maletas escolhidas.`}
          </p>
          <DemoControls stage={stage} teams={teams} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:sticky lg:top-4">
        <section className="panel p-3" aria-labelledby="previa-titulo">
          <h2 id="previa-titulo" className="mb-3 text-lg font-black">
            Na mesa agora
          </h2>
          <p role="status" className="mb-3 text-sm font-bold text-gold">
            {stage.event?.message ?? "Nada aconteceu no palco ainda."}
          </p>
          {stage.view === "confronto" ? (
            // Em colunas estreitas, a grade 2×2 é a mais legível.
            <div className="[&_ul]:grid-cols-2! [&_li:nth-child(3)]:order-4! [&_li:nth-child(4)]:order-3!">
              <Duel stage={stage} teams={teams} />
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="rounded-xl border-l-8 bg-espresso/60 p-3"
                  style={{ borderColor: TEAM_COLORS[team.id] }}
                >
                  <span className="block truncate text-sm font-bold">{team.name}</span>
                  <span className="font-display text-2xl text-gold">
                    {stage.picks[team.id] ? `Maleta ${stage.picks[team.id]}` : "—"}
                  </span>
                  <span className="block text-xs">Bônus fixo +{stage.bonuses[team.id]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="demo-box" aria-label="Ajustes da demonstração">
          <p className="demo-label">Ajustes da demonstração</p>
          <AtmosferaToggle className="mt-3 w-full" />
          {confirmingReset ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn btn-primary text-sm"
                onClick={() => {
                  updateDemo(createDefaultState);
                  setConfirmingReset(false);
                }}
              >
                Sim, apagar tudo
              </button>
              <button type="button" className="btn btn-ghost text-sm" onClick={() => setConfirmingReset(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost mt-3 w-full text-sm" onClick={() => setConfirmingReset(true)}>
              Apagar dados salvos da demonstração…
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
