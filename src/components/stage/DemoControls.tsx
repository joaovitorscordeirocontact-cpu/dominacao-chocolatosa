"use client";

import { useState } from "react";
import { TEAM_COLORS, TEAM_IDS } from "@/lib/catalog";
import {
  addBonus,
  allPicked,
  autoPick,
  backToBoard,
  BONUS_VALUES,
  openCases,
  resetStage,
  rotateCases,
  showDuel,
  swapCases,
} from "@/lib/stage";
import { updateDemo } from "@/lib/store";
import type { Stage, Team, TeamId } from "@/lib/types";

function TeamChips({
  teams,
  selected,
  onToggle,
  label,
}: {
  teams: Team[];
  selected: TeamId[];
  onToggle: (id: TeamId) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {teams.map((team) => {
        const active = selected.includes(team.id);
        return (
          <button
            key={team.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(team.id)}
            className={`min-h-12 cursor-pointer rounded-xl border-2 border-l-8 px-2 py-1 text-left text-xs leading-tight font-extrabold ${
              active ? "bg-cream text-espresso" : "bg-espresso/70"
            }`}
            style={{ borderColor: TEAM_COLORS[team.id] }}
          >
            {active && "✓ "}F{TEAM_IDS.indexOf(team.id) + 1} · {team.name}
          </button>
        );
      })}
    </div>
  );
}

/** Comandos de DEMONSTRAÇÃO do palco (na versão final, são decisões da moderação). */
export function DemoControls({ stage, teams }: { stage: Stage; teams: Team[] }) {
  const [swap, setSwap] = useState<TeamId[]>([]);
  const [bonusTeam, setBonusTeam] = useState<TeamId>("t1");
  const duel = stage.view === "confronto";
  const complete = allPicked(stage);

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Andamento da rodada" className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2">
        {duel ? (
          <>
            <button type="button" className="btn btn-primary text-lg" disabled={stage.revealed} onClick={() => updateDemo(openCases)}>
              {stage.revealed ? "Maletas abertas" : "Abrir as quatro maletas"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={stage.revealed} onClick={() => updateDemo(backToBoard)}>
              Voltar ao painel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" disabled={complete} onClick={() => updateDemo((s) => autoPick(s))}>
              Sortear as que faltam
            </button>
            <button type="button" className="btn btn-primary text-lg" disabled={!complete} onClick={() => updateDemo(showDuel)}>
              Ver o confronto
            </button>
          </>
        )}
      </section>

      <section aria-labelledby="inverter-titulo">
        <p id="inverter-titulo" className="mb-2 text-sm font-black text-blush uppercase">
          Inversão
        </p>
        <button type="button" className="btn btn-gold w-full" disabled={!duel} onClick={() => updateDemo(rotateCases)}>
          <span aria-hidden="true">↻</span> Inverter: todas avançam uma fábrica
        </button>
        {!duel && <p className="mt-2 text-xs text-cream/75">Disponível no confronto.</p>}
      </section>

      <section aria-labelledby="coringa-titulo">
        <p id="coringa-titulo" className="mb-2 text-sm font-black text-blush uppercase">
          Coringa: trocar duas maletas
        </p>
        <TeamChips
          teams={teams}
          label="Escolha duas fábricas para trocar"
          selected={swap}
          onToggle={(id) =>
            setSwap((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current.slice(-1), id]))
          }
        />
        <button
          type="button"
          className="btn btn-gold mt-3 w-full"
          disabled={!duel || swap.length !== 2}
          onClick={() => {
            updateDemo((s) => swapCases(s, swap[0], swap[1]));
            setSwap([]);
          }}
        >
          <span aria-hidden="true">⇄</span> Trocar as duas selecionadas
        </button>
      </section>

      <section aria-labelledby="bonus-titulo">
        <p id="bonus-titulo" className="mb-2 text-sm font-black text-blush uppercase">
          Bônus fixo da fábrica
        </p>
        <TeamChips teams={teams} label="Fábrica que recebe o bônus" selected={[bonusTeam]} onToggle={setBonusTeam} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          {BONUS_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              className="btn btn-gold text-lg"
              onClick={() => updateDemo((s) => addBonus(s, bonusTeam, value))}
            >
              Aplicar +{value}
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="btn btn-ghost text-sm" onClick={() => updateDemo(resetStage)}>
        Reiniciar o palco (maletas e bônus)
      </button>
    </div>
  );
}
