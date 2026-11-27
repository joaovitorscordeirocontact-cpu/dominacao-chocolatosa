"use client";

/** Telão: composição própria, com imagens grandes, pouco texto e foco no momento atual. */
/* eslint-disable @next/next/no-img-element */
import { PerspectiveSwitcher } from "@/components/demo/PerspectiveSwitcher";
import { Avatar } from "@/components/mascot/Avatar";
import { CaseBoard } from "@/components/stage/CaseBoard";
import { Duel } from "@/components/stage/Duel";
import { ChocolateWave } from "@/components/ui/ChocolateWave";
import { TEAM_COLORS, TEAM_IDS } from "@/lib/catalog";
import { buildTeams } from "@/lib/mock-data";
import { useDemoState, useHydrated } from "@/lib/store";
import type { DemoState, Team } from "@/lib/types";

function headline({ stage, battle }: DemoState): string {
  if (stage.view === "confronto") {
    return stage.event?.message ?? "Confronto";
  }
  if (Object.values(stage.picks).some(Boolean)) return stage.event?.message ?? "Escolham suas maletas";
  return battle.started ? "Batalha pelas cartas!" : "As fábricas estão chegando";
}

function Factories({ state, teams }: { state: DemoState; teams: Team[] }) {
  return (
    <ul className="grid h-full grid-cols-2 gap-[1.4vw] lg:grid-cols-4">
      {teams.map((team) => {
        const { battle } = state;
        // Antes do início, o telão não antecipa quem foi escolhido.
        const representative = battle.started
          ? team.participants.find((p) => p.id === battle.representatives[team.id])
          : undefined;
        return (
          <li
            key={team.id}
            className="flex min-h-0 flex-col overflow-hidden rounded-3xl border-4 bg-chocolate shadow-panel"
            style={{ borderColor: TEAM_COLORS[team.id] }}
          >
            <div className={`fundo-${team.background} relative min-h-40 flex-1`}>
              <img
                src={`/assets/fabricas/${team.model}.webp`}
                alt=""
                className="factory-pop absolute inset-x-[4%] bottom-[4%] h-[88%] w-[92%] object-contain object-bottom"
              />
            </div>
            <div className="flex flex-col items-center gap-[1vh] px-2 py-[1.6vh] text-center">
              <h2 className="gold-text text-[clamp(1.25rem,2.4vw,3rem)] leading-tight break-words">{team.name}</h2>
              {representative ? (
                <div className="factory-pop flex items-center gap-2">
                  <Avatar look={representative} className="size-[clamp(3.5rem,6vw,7rem)]" />
                  <span className="text-[clamp(1.1rem,1.9vw,2.4rem)] font-black">{representative.name}</span>
                </div>
              ) : (
                <div className="flex h-[clamp(3.5rem,6vw,7rem)] items-center justify-center -space-x-3">
                  {team.participants.slice(0, 5).map((participant) => (
                    <Avatar key={participant.id} look={participant} className="size-[clamp(2.5rem,3.8vw,4.6rem)]" />
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function BigScreen() {
  const state = useDemoState();
  const hydrated = useHydrated();
  const teams = buildTeams(state);
  const { stage, settings } = state;
  const duel = stage.view === "confronto";
  const board = !duel && Object.values(stage.picks).some(Boolean);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  return (
    <div className="relative isolate flex min-h-svh flex-col gap-[1.5vh] px-[2vw] pt-[1.5vh] pb-[max(1vh,env(safe-area-inset-bottom))] lg:h-svh">
      <ChocolateWave className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[11vh] w-full" />
      <header className="text-center">
        <p className="gold-text text-[clamp(1.1rem,2.2vw,2.8rem)] uppercase">
          Dominação Chocolatosa <span className="text-pink">· Topa ou Arrisca?</span>
        </p>
        {settings.showAtmosfera && (
          <p className="text-[clamp(0.65rem,0.9vw,1.1rem)] font-extrabold tracking-[0.4em] text-gold uppercase [text-shadow:0_1px_2px_#000,0_0_8px_#000]">
            Atmosfera Jovem
          </p>
        )}
        <div role="status">
          <h1
            key={hydrated ? headline(state) + (stage.event?.seq ?? 0) : "carregando"}
            className="factory-pop mt-[1vh] font-display text-[clamp(1.8rem,4.4vw,5.5rem)] leading-tight text-cream [text-shadow:0_4px_0_#7d0a42,0_6px_18px_#000]"
          >
            {hydrated ? headline(state) : "…"}
          </h1>
        </div>
      </header>

      <main className={`min-h-0 flex-1 ${hydrated ? "" : "invisible"}`}>
        {duel ? (
          <Duel stage={stage} teams={teams} tv />
        ) : board ? (
          <div className="flex h-full flex-col gap-[2vh]">
            <CaseBoard stage={stage} teams={teams} className="min-h-0 flex-1 grid-cols-6 md:grid-cols-12 lg:auto-rows-fr" />
            <ul className="grid grid-cols-2 gap-[1vw] md:grid-cols-4">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="flex items-center gap-3 rounded-2xl border-4 bg-chocolate px-3 py-1"
                  style={{ borderColor: TEAM_COLORS[team.id] }}
                >
                  <img src={`/assets/fabricas/${team.model}.webp`} alt="" className="h-[9vh] max-h-24 w-auto" />
                  <span className="min-w-0 text-[clamp(0.9rem,1.5vw,2rem)] font-black">
                    <span className="block truncate">
                      F{TEAM_IDS.indexOf(team.id) + 1} · {team.name}
                    </span>
                    <span className="font-display text-[1.4em] font-normal text-gold">
                      {stage.picks[team.id] ? `Maleta ${stage.picks[team.id]}` : "escolhendo…"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Factories state={state} teams={teams} />
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-cream/70">
        <span>Demonstração local · dados fictícios</span>
        <span className="flex gap-2">
          <button type="button" className="btn btn-ghost min-h-11! px-4! py-1! text-xs" onClick={toggleFullscreen}>
            Tela cheia
          </button>
          <PerspectiveSwitcher />
        </span>
      </footer>
    </div>
  );
}
