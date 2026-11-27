/* eslint-disable @next/next/no-img-element */
import { FitName } from "@/components/ui/FitName";
import { asset } from "@/lib/assets";
import { teamColor } from "@/lib/catalog";
import { chocolates, standings, teamViews } from "@/lib/room/model";
import type { Snapshot } from "@/lib/room/types";

/** Placar público: saldo de cada fábrica e estoque no banco. */
export function Scoreboard({ snapshot, mine, tv = false }: { snapshot: Snapshot; mine?: string | null; tv?: boolean }) {
  const teams = teamViews(snapshot);
  return (
    <section aria-label="Placar de bombons">
      <ul className={`grid gap-2 ${tv ? "grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(14vw,1fr))]" : "grid-cols-2"}`}>
        {teams.map((team) => (
          <li
            key={team.id}
            className={`flex min-w-0 items-center gap-2 rounded-2xl border-2 border-l-8 bg-chocolate/90 px-2 py-1.5 ${
              team.id === mine ? "shadow-[0_0_0_2px_#efc879]" : ""
            }`}
            style={{ borderColor: teamColor(team.slot) }}
          >
            <img
              src={asset(`/assets/fabricas/${team.model}.webp`)}
              alt=""
              className={tv ? "size-[clamp(2.5rem,4vw,5rem)] object-contain" : "size-9 object-contain"}
            />
            <span className="min-w-0 flex-1">
              <FitName className={`leading-tight font-extrabold ${tv ? "text-[clamp(0.9rem,1.3vw,1.6rem)]" : "text-xs"}`}>
                {team.label}
              </FitName>
              <span className={`font-display text-gold tabular-nums ${tv ? "text-[clamp(1.4rem,2.2vw,2.8rem)]" : "text-xl"}`}>
                {team.balance}
              </span>
              <span className="sr-only"> bombons</span>
            </span>
          </li>
        ))}
        {snapshot.room.bank !== null && (
          <li className="flex min-w-0 flex-col justify-center rounded-2xl border-2 border-dashed border-gold/60 bg-espresso/80 px-3 py-1.5">
            <span className={`font-extrabold ${tv ? "text-[clamp(0.9rem,1.3vw,1.6rem)]" : "text-xs"}`}>Banco</span>
            <span className={`font-display text-gold tabular-nums ${tv ? "text-[clamp(1.4rem,2.2vw,2.8rem)]" : "text-xl"}`}>
              {snapshot.room.bank}
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}

/** Classificação final e estoque restante, para orientar a entrega dos chocolates. */
export function FinalStandings({ snapshot, tv = false }: { snapshot: Snapshot; tv?: boolean }) {
  const table = standings(teamViews(snapshot));
  return (
    <div>
      <ol className={`grid ${tv ? `gap-[1.6vh] ${table.length > 2 ? "lg:grid-cols-2" : ""}` : "gap-3"}`}>
        {table.map(({ team, position }) => (
          <li
            key={team.id}
            className={`flex items-center rounded-2xl border-2 border-l-8 bg-chocolate/90 ${
              tv ? "gap-[1.6vw] px-[1.6vw] py-[1vh]" : "gap-3 p-3"
            }`}
            style={{ borderColor: teamColor(team.slot) }}
          >
            <span className={`gold-text shrink-0 text-center ${tv ? "w-[7vw] text-[clamp(2rem,min(4.5vw,7vh),6rem)]" : "w-12 text-3xl"}`}>
              {position}º
            </span>
            <img
              src={asset(`/assets/fabricas/${team.model}.webp`)}
              alt=""
              className={`shrink-0 object-contain ${tv ? "size-[min(9vw,13vh)]" : "size-14"}`}
            />
            <span className="min-w-0 flex-1">
              <FitName
                className={`leading-tight font-black ${tv ? "text-[clamp(1.2rem,min(2.8vw,4.6vh),3.8rem)]" : "text-lg"}`}
                min={tv ? 18 : 12}
              >
                {team.label}
              </FitName>
              <span className={`font-display text-gold ${tv ? "text-[clamp(1.4rem,min(2.6vw,4.4vh),3.6rem)]" : "text-2xl"}`}>
                {chocolates(team.balance)}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p
        className={`mt-4 rounded-2xl border-2 border-dashed border-gold/60 bg-espresso/80 p-4 text-center font-bold ${
          tv ? "text-[clamp(1rem,min(1.6vw,2.8vh),2.2rem)]" : ""
        }`}
      >
        Estoque restante no banco: <strong className="text-gold">{chocolates(snapshot.room.bank ?? 0)}</strong> de{" "}
        {snapshot.room.totalChocolates}. A liderança decide o destino; nada é distribuído automaticamente.
      </p>
    </div>
  );
}
