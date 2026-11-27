"use client";

import { teamColor } from "@/lib/catalog";
import { availableCount, boardCases, type TeamView } from "@/lib/room/model";
import type { Snapshot } from "@/lib/room/types";

/**
 * Painel das maletas ainda em jogo. Maletas consumidas em rodadas anteriores
 * saem do painel. Com `onSelect`, é interativo; sem ele, só exibição.
 */
export function CaseBoard({
  snapshot,
  teams,
  selected = null,
  disabled = false,
  onSelect,
  className = "grid-cols-5 min-[460px]:grid-cols-6 md:grid-cols-10",
}: {
  snapshot: Snapshot;
  teams: TeamView[];
  selected?: number | null;
  disabled?: boolean;
  onSelect?: (caseNumber: number) => void;
  className?: string;
}) {
  const cases = boardCases(snapshot);
  return (
    <ol
      className={`grid gap-x-2 gap-y-3 ${className}`}
      aria-label={`Painel de maletas: ${availableCount(snapshot)} disponíveis`}
    >
      {cases.map(({ number, state }) => {
        const owner = state === "available" ? undefined : teams.find((team) => team.round?.caseNumber === number);
        const isSelected = selected === number;
        // O nome acessível vem do próprio conteúdo: "Maleta 7 F2, com Cacau Real".
        const content = (
          <>
            <span className="sr-only">Maleta </span>
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 h-2.5 w-2/5 -translate-x-1/2 rounded-t-md border-2 border-b-0 border-[#d9a443]"
              style={owner ? { borderColor: teamColor(owner.slot) } : undefined}
            />
            <span
              className={`mt-2 grid w-full flex-1 place-items-center rounded-lg border font-display text-xl tabular-nums shadow-[0_3px_0_rgb(0_0_0/0.4)] ${
                owner
                  ? "border-white/80 text-espresso"
                  : isSelected
                    ? "border-white bg-pink text-white ring-4 ring-gold"
                    : "border-[#ffe9a8] bg-linear-to-b from-[#ffe9a0] via-[#e9b84a] to-[#b98122] text-[#3a1d06]"
              }`}
              style={owner ? { background: teamColor(owner.slot) } : undefined}
            >
              {number}
            </span>
            {owner && (
              <>
                <span className="absolute -right-1 -bottom-1.5 grid size-5 place-items-center rounded-full border border-cream bg-espresso text-[0.65rem] font-black text-cream">
                  F{owner.slot}
                </span>
                <span className="sr-only">, com {owner.label}</span>
              </>
            )}
          </>
        );
        const base = "relative flex h-full min-h-12 w-full flex-col items-stretch";
        return (
          <li key={number} className="min-w-0">
            {onSelect ? (
              <button
                type="button"
                className={`${base} cursor-pointer transition-transform active:scale-90 disabled:cursor-not-allowed ${
                  isSelected ? "-translate-y-1" : ""
                }`}
                disabled={disabled || state !== "available"}
                aria-pressed={isSelected}
                onClick={() => onSelect(number)}
              >
                {content}
              </button>
            ) : (
              <div className={base}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
