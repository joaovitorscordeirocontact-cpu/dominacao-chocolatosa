"use client";

/** Palco visto pelo capitão (celular). */
import { useState } from "react";
import { ActionBar } from "@/components/ui/Screen";
import { TEAM_COLORS, TEAM_IDS } from "@/lib/catalog";
import { buildTeams } from "@/lib/mock-data";
import { allPicked, pickCase, showDuel } from "@/lib/stage";
import { updateDemo, useDemoState, useHydrated } from "@/lib/store";
import type { TeamId } from "@/lib/types";
import { CaseBoard } from "./CaseBoard";
import { DemoControls } from "./DemoControls";
import { Duel } from "./Duel";
import { FitName } from "@/components/ui/FitName";

export function StagePlayer() {
  const state = useDemoState();
  const hydrated = useHydrated();
  const teams = buildTeams(state);
  const { stage } = state;
  // Escolher "por outra fábrica" é um recurso da demonstração.
  const [activeTeam, setActiveTeam] = useState<TeamId>("t1");
  const active = teams.find((team) => team.id === activeTeam) ?? teams[0];
  const activePick = stage.picks[activeTeam];
  const complete = allPicked(stage);

  function pick(caseNumber: number) {
    updateDemo((current) => pickCase(current, activeTeam, caseNumber));
  }

  if (!hydrated) return <p className="py-10 text-center font-bold">Carregando o palco…</p>;

  const announcement = (
    <p role="status" className="sr-only">
      {stage.event?.message}
    </p>
  );

  if (stage.view === "confronto") {
    return (
      <div className="flex flex-col gap-4">
        {announcement}
        <p aria-hidden="true" className="text-center font-black text-gold">
          {stage.event?.message}
        </p>
        <Duel stage={stage} teams={teams} />
        <details className="demo-box" open>
          <summary>Controles de demonstração</summary>
          <div className="mt-3">
            <DemoControls stage={stage} teams={teams} />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div>
      {announcement}
      <section className="demo-box" aria-label="Controle de demonstração">
        <p className="demo-label">Demonstração · escolher como</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              aria-pressed={team.id === activeTeam}
              onClick={() => setActiveTeam(team.id)}
              className={`min-h-12 cursor-pointer rounded-xl border-2 border-l-8 px-2 py-1 text-left text-xs leading-tight font-extrabold ${
                team.id === activeTeam ? "bg-cream text-espresso" : "bg-espresso/70"
              }`}
              style={{ borderColor: TEAM_COLORS[team.id] }}
            >
              <FitName>{`F${TEAM_IDS.indexOf(team.id) + 1} · ${team.name}`}</FitName>
              <span className="block opacity-80">
                {stage.picks[team.id] ? `Maleta ${stage.picks[team.id]}` : "sem maleta"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <h2 className="mt-4 text-center text-lg font-black">
        {activePick ? `${active.name}: maleta ${activePick}` : `${active.name}, escolha uma maleta`}
      </h2>
      <p className="mb-4 text-center text-sm text-cream/80">
        {activePick ? "Toque nela de novo para desmarcar, ou em outra para trocar." : "Maletas de outras fábricas ficam indisponíveis."}
      </p>

      <CaseBoard stage={stage} teams={teams} activeTeam={activeTeam} onPick={pick} />

      <details className="demo-box mt-5">
        <summary>Mais controles de demonstração</summary>
        <div className="mt-3">
          <DemoControls stage={stage} teams={teams} />
        </div>
      </details>

      <ActionBar>
        {complete ? (
          <button type="button" className="btn btn-primary text-lg" onClick={() => updateDemo(showDuel)}>
            Ver o confronto <span aria-hidden="true">→</span>
          </button>
        ) : activePick ? (
          <button
            type="button"
            className="btn btn-gold"
            onClick={() => setActiveTeam(TEAM_IDS.find((id) => !stage.picks[id]) ?? activeTeam)}
          >
            Demo: próxima fábrica <span aria-hidden="true">→</span>
          </button>
        ) : (
          <p className="rounded-2xl border border-gold/25 bg-espresso/95 px-3 py-2 text-sm font-bold">
            {TEAM_IDS.filter((id) => stage.picks[id]).length} de 4 maletas escolhidas
          </p>
        )}
      </ActionBar>
    </div>
  );
}
