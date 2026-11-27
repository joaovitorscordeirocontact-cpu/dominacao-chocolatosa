"use client";

import { TEAM_COLORS, TEAM_IDS } from "@/lib/catalog";
import { CASE_COUNT, ownerOf } from "@/lib/stage";
import type { Stage, Team, TeamId } from "@/lib/types";

const NUMBERS = Array.from({ length: CASE_COUNT }, (_, index) => index + 1);

/**
 * Painel das 60 maletas. Com `onPick`, é interativo; sem ele, é só exibição (telão).
 * Quem está com a maleta aparece por número de equipe, não apenas por cor.
 */
export function CaseBoard({
  stage,
  teams,
  activeTeam,
  onPick,
  className = "grid-cols-5 min-[460px]:grid-cols-6 md:grid-cols-10",
}: {
  stage: Stage;
  teams: Team[];
  activeTeam?: TeamId;
  onPick?: (caseNumber: number) => void;
  className?: string;
}) {
  return (
    <ol className={`grid gap-x-2 gap-y-3 ${className}`} aria-label="Painel com 60 maletas">
      {NUMBERS.map((number) => {
        const owner = ownerOf(stage, number);
        const team = teams.find((option) => option.id === owner);
        const position = owner ? TEAM_IDS.indexOf(owner) + 1 : 0;
        const unavailable = Boolean(owner && owner !== activeTeam);
        // O nome acessível vem do próprio conteúdo: "Maleta 7 F2, com Cacau Real".
        const content = (
          <>
            <span className="sr-only">Maleta </span>
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 h-2.5 w-2/5 -translate-x-1/2 rounded-t-md border-2 border-b-0 border-[#d9a443]"
              style={owner ? { borderColor: TEAM_COLORS[owner] } : undefined}
            />
            <span
              className={`mt-2 grid w-full flex-1 place-items-center rounded-lg border font-display text-xl tabular-nums shadow-[0_3px_0_rgb(0_0_0/0.4)] ${
                owner
                  ? "border-white/80 text-espresso"
                  : "border-[#ffe9a8] bg-linear-to-b from-[#ffe9a0] via-[#e9b84a] to-[#b98122] text-[#3a1d06]"
              }`}
              style={owner ? { background: TEAM_COLORS[owner] } : undefined}
            >
              {number}
            </span>
            {owner && (
              <span
                className="absolute -right-1 -bottom-1.5 grid size-5 place-items-center rounded-full border border-cream bg-espresso text-[0.65rem] font-black text-cream"
              >
                F{position}
              </span>
            )}
            {team && <span className="sr-only">, com {team.name}</span>}
          </>
        );
        const base = "relative flex h-full min-h-12 w-full flex-col items-stretch";
        return (
          <li key={number} className="min-w-0">
            {onPick ? (
              <button
                type="button"
                className={`${base} cursor-pointer transition-transform active:scale-90 disabled:cursor-not-allowed ${
                  owner === activeTeam && owner ? "-translate-y-1" : ""
                }`}
                disabled={unavailable}
                aria-pressed={Boolean(owner)}
                onClick={() => onPick(number)}
              >
                {content}
              </button>
            ) : (
              <div className={base}>
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
