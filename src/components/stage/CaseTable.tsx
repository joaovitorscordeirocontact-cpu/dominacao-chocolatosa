"use client";

/* eslint-disable @next/next/no-img-element */
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { FitName } from "@/components/ui/FitName";
import { asset } from "@/lib/assets";
import { teamColor } from "@/lib/catalog";
import { inPlayOrder, signed, teamViews } from "@/lib/room/model";
import type { Snapshot } from "@/lib/room/types";
import { Briefcase } from "./Briefcase";

/** Última fábrica de cada maleta (o componente é remontado quando ela muda de quadro). */
const lastPosition = new Map<string, string>();

/** Maleta em movimento: `layoutId` desliza entre fábricas; o salto reforça o trajeto. */
function MovingCase({
  id,
  team,
  className,
  children,
}: {
  id: string;
  team: string;
  className: string;
  children: React.ReactNode;
}) {
  const lift = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const from = lastPosition.get(id);
    lastPosition.set(id, team);
    if (!from || from === team || reducedMotion) return;
    lift.current?.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(-18px) scale(1.18)", offset: 0.5 },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 850, easing: "ease-in-out" },
    );
  }, [id, team, reducedMotion]);

  return (
    <motion.div
      layoutId={`maleta-${id}`}
      transition={{ layout: { duration: reducedMotion ? 0 : 0.85, ease: [0.45, 0, 0.2, 1] } }}
      className={`relative z-20 mx-auto w-full ${className}`}
    >
      <div ref={lift}>{children}</div>
    </motion.div>
  );
}

const COLUMNS: Record<number, string> = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" };

/**
 * A mesa da rodada, na ordem de jogada: cada fábrica e a maleta que está com ela.
 * No celular, quatro fábricas formam um 2×2 em sentido horário, para a inversão
 * "girar" na tela.
 */
export function CaseTable({ snapshot, tv = false }: { snapshot: Snapshot; tv?: boolean }) {
  const teams = inPlayOrder(teamViews(snapshot));
  const results = snapshot.settlement ?? snapshot.payments.filter((p) => p.round === snapshot.room.round);
  const lastSpecial = snapshot.history[0]?.type === "register_special" ? snapshot.history[0].data : null;
  const clockwise = (index: number) =>
    teams.length === 4 ? ["order-1", "order-2", "order-4 md:order-3", "order-3 md:order-4"][index] : "";

  return (
    <LayoutGroup>
      <ul className={`grid grid-cols-2 gap-2 ${COLUMNS[teams.length]} ${tv ? "h-full gap-[1.2vw]!" : "md:gap-3"}`}>
        {teams.map((team, index) => {
          const row = team.round;
          if (!row) return null;
          const number = row.caseNumber;
          const opened = snapshot.cases.find((item) => item.number === number);
          const content = opened?.kind ? { kind: opened.kind, amount: opened.amount! } : null;
          const result = results.find((item) => item.teamId === team.id);
          const highlighted =
            lastSpecial?.teamId === team.id || (lastSpecial?.targetTeamId === team.id && lastSpecial.power === "joker");
          return (
            <li
              key={team.id}
              data-team={team.slot}
              className={`flex min-w-0 flex-col rounded-2xl border-2 bg-chocolate/90 p-1.5 ${clockwise(index)} ${
                highlighted ? "shadow-[0_0_0_3px_#efc879,0_0_28px_rgb(239_200_121/0.65)]" : "shadow-panel"
              }`}
              style={{ borderColor: teamColor(team.slot) }}
            >
              {/* No celular o nome fica abaixo da miniatura e usa a coluna inteira. */}
              <div className={`flex items-center gap-1.5 ${tv ? "" : "flex-col text-center sm:flex-row sm:text-left"}`}>
                <span className={`fundo-${team.background} shrink-0 overflow-hidden rounded-lg ${tv ? "size-[4.4vw]" : "size-10"}`}>
                  <img src={asset(`/assets/fabricas/${team.model}.webp`)} alt="" className="size-full object-contain" />
                </span>
                <p className={`min-w-0 leading-tight font-black ${tv ? "flex-1 text-[clamp(1rem,1.7vw,2.2rem)]" : "w-full text-sm sm:w-auto sm:flex-1"}`}>
                  <span className="block text-[0.7em] text-blush">
                    {row.playPosition ? `${row.playPosition}ª a jogar` : `F${team.slot}`}
                  </span>
                  <FitName min={tv ? 14 : 12}>{team.label}</FitName>
                </p>
              </div>

              <div className={`flex flex-1 items-center justify-center ${tv ? "py-[1vh]" : "min-h-28 py-3"}`}>
                {number === null ? (
                  <p className="rounded-xl border-2 border-dashed border-cream/30 px-3 py-4 text-center text-sm font-bold text-cream/70">
                    sem maleta
                  </p>
                ) : (
                  <MovingCase
                    key={number}
                    id={`${snapshot.room.id}-${number}`}
                    team={team.id}
                    // No telão a maleta também respeita a ALTURA da tela.
                    className={tv ? "max-w-[min(15rem,22vh)]" : "max-w-60"}
                  >
                    <Briefcase number={number} content={content} revealKey={`${snapshot.room.id}-${number}`} />
                  </MovingCase>
                )}
              </div>

              <dl className={`grid font-extrabold tabular-nums ${tv ? "gap-[0.4vh] text-[clamp(0.75rem,min(1.2vw,2vh),1.6rem)]" : "gap-1 text-xs"}`}>
                <div className={`flex items-center justify-between gap-1 rounded-lg bg-espresso/70 px-2 ${tv ? "py-[0.2vh]" : "py-1"}`}>
                  <dt>Saldo inicial</dt>
                  <dd>{row.startBalance}</dd>
                </div>
                {result && (
                  <div className={`flex items-center justify-between gap-1 rounded-lg bg-espresso/70 px-2 ${tv ? "py-[0.2vh]" : "py-1"}`}>
                    <dt>Maleta</dt>
                    {/* A chave inclui o número: o valor "reaparece" quando outra maleta chega. */}
                    <dd key={number} className="value-in">
                      {signed(result.delta)}
                    </dd>
                  </div>
                )}
                {row.blocked && (
                  <div className={`bonus-flash flex items-center justify-between gap-1 rounded-lg border border-[#8fd0ff]/70 bg-[#8fd0ff]/15 px-2 text-[#bfe3ff] ${tv ? "py-[0.2vh]" : "py-1"}`}>
                    <dt>Bloqueio</dt>
                    <dd>{result && result.delta < 0 ? `anulou ${signed(result.delta)}` : "ativo"}</dd>
                  </div>
                )}
                {(row.bonus > 0 || result) && (
                  <div
                    key={row.bonus}
                    className={`flex items-center justify-between gap-1 rounded-lg border border-gold/60 bg-gold/15 px-2 text-gold ${
                      tv ? "py-[0.2vh]" : "py-1"
                    } ${row.bonus > 0 ? "bonus-flash" : ""}`}
                  >
                    <dt>Bônus fixo</dt>
                    <dd>{signed(row.bonus)}</dd>
                  </div>
                )}
                {result && (
                  <div className={`rounded-lg bg-cream px-2 text-center text-espresso ${tv ? "py-[0.2vh]" : "py-1"}`}>
                    <dt className="text-[0.75em] leading-tight uppercase">
                      {snapshot.room.stage === "paid" ? "Saldo final" : "Saldo provisório"}
                    </dt>
                    <dd className="font-display text-[1.9em] leading-none font-normal">{result.finalBalance}</dd>
                  </div>
                )}
              </dl>
            </li>
          );
        })}
      </ul>
    </LayoutGroup>
  );
}
