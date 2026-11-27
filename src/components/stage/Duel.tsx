"use client";

/* eslint-disable @next/next/no-img-element */
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { FitName } from "@/components/ui/FitName";
import { TEAM_COLORS, TEAM_IDS } from "@/lib/catalog";
import { caseResult, signed } from "@/lib/stage";
import type { Stage, Team, TeamId } from "@/lib/types";
import { Briefcase } from "./Briefcase";

/**
 * No celular a grade é 2×2 em sentido horário, para a inversão "girar" na tela;
 * em telas largas as quatro fábricas ficam em fila.
 */
const ORDER: Record<TeamId, string> = {
  t1: "order-1",
  t2: "order-2",
  t3: "order-4 md:order-3",
  t4: "order-3 md:order-4",
};

/** Última fábrica de cada maleta (o componente é remontado quando ela muda de quadro). */
const lastPosition = new Map<number, TeamId>();

/** Maleta em movimento: `layoutId` desliza entre fábricas; o salto reforça o trajeto. */
function MovingCase({ number, open, team }: { number: number; open: boolean; team: TeamId }) {
  const lift = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const from = lastPosition.get(number);
    lastPosition.set(number, team);
    if (!from || from === team || reducedMotion) return;
    lift.current?.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(-18px) scale(1.18)", offset: 0.5 },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 850, easing: "ease-in-out" },
    );
  }, [number, team, reducedMotion]);

  return (
    <motion.div
      layoutId={`maleta-${number}`}
      transition={{ layout: { duration: 0.85, ease: [0.45, 0, 0.2, 1] } }}
      className="relative z-20 mx-auto w-full max-w-64"
    >
      <div ref={lift}>
        <Briefcase number={number} open={open} />
      </div>
    </motion.div>
  );
}

export function Duel({ stage, teams, tv = false }: { stage: Stage; teams: Team[]; tv?: boolean }) {
  return (
    <LayoutGroup>
      <ul className={`grid grid-cols-2 gap-2 md:grid-cols-4 ${tv ? "h-full gap-[1.2vw]!" : "md:gap-3"}`}>
        {teams.map((team) => {
          const number = stage.picks[team.id];
          const bonus = stage.bonuses[team.id];
          const result = number !== null && stage.revealed ? caseResult(number) : null;
          const highlighted = Boolean(stage.event?.teams.includes(team.id));
          const position = TEAM_IDS.indexOf(team.id) + 1;
          return (
            <li
              key={team.id}
              data-team={team.id}
              className={`flex min-w-0 flex-col rounded-2xl border-2 bg-chocolate/90 p-1.5 ${ORDER[team.id]} ${
                highlighted ? "shadow-[0_0_0_3px_#efc879,0_0_28px_rgb(239_200_121/0.65)]" : "shadow-panel"
              }`}
              style={{ borderColor: TEAM_COLORS[team.id] }}
            >
              <div className="flex items-center gap-1.5">
                <span className={`fundo-${team.background} shrink-0 overflow-hidden rounded-lg ${tv ? "size-[4.4vw]" : "size-10"}`}>
                  <img src={`/assets/fabricas/${team.model}.webp`} alt="" className="size-full object-contain" />
                </span>
                <p className={`min-w-0 flex-1 leading-tight font-black ${tv ? "text-[clamp(1rem,1.7vw,2.2rem)]" : "text-xs sm:text-sm"}`}>
                  <span className="block text-[0.7em] text-blush">F{position}</span>
                  <FitName min={tv ? 14 : 11}>{team.name}</FitName>
                </p>
              </div>

              <div className={`flex flex-1 items-center justify-center ${tv ? "py-[2vh]" : "pt-3 pb-3"}`}>
                {number !== null && <MovingCase key={number} number={number} open={stage.revealed} team={team.id} />}
              </div>

              <dl className={`grid gap-1 font-extrabold tabular-nums ${tv ? "text-[clamp(0.9rem,1.35vw,1.7rem)]" : "text-xs"}`}>
                <div className="flex items-center justify-between gap-1 rounded-lg bg-espresso/70 px-2 py-1">
                  <dt>Maleta</dt>
                  <dd>
                    {result === null ? (
                      "?"
                    ) : (
                      // A chave inclui o número: o valor "reaparece" quando outra maleta chega.
                      <span key={number} className="value-in">
                        {signed(result)}
                      </span>
                    )}
                  </dd>
                </div>
                <div
                  key={bonus}
                  className={`flex items-center justify-between gap-1 rounded-lg border border-gold/60 bg-gold/15 px-2 py-1 text-gold ${
                    bonus > 0 ? "bonus-flash" : ""
                  }`}
                >
                  <dt>Bônus fixo</dt>
                  <dd>{signed(bonus)}</dd>
                </div>
                <div className="rounded-lg bg-cream px-2 py-1 text-center text-espresso">
                  <dt className="text-[0.75em] leading-tight uppercase">Provisório da rodada</dt>
                  <dd className="font-display text-[1.9em] leading-none font-normal">
                    {result === null ? "—" : signed(result + bonus)}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </LayoutGroup>
  );
}
