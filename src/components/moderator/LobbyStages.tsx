"use client";

/** Etapas anteriores à partida: lobby, capitães, fábricas e economia. */
import { useState } from "react";
import { FactoryCard } from "@/components/factory/FactoryCard";
import { MemberCard } from "@/components/room/MemberCard";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { teamColor } from "@/lib/catalog";
import { planEconomy } from "@/lib/room/economy";
import { memberName, teamViews } from "@/lib/room/model";
import type { Snapshot } from "@/lib/room/types";
import type { Commands } from "@/lib/room/useCommand";

type Props = { snapshot: Snapshot; commands: Commands };

export function LobbyStage({ snapshot, commands }: Props) {
  const players = snapshot.members.filter((member) => member.kind === "player");
  const [teamCount, setTeamCount] = useState(4);
  const [picked, setPicked] = useState<string[]>([]);
  // Quem saiu da sala deixa de contar como capitão escolhido.
  const captains = picked.filter((id) => players.some((p) => p.id === id)).slice(0, teamCount);
  const busy = commands.pending !== null;

  return (
    <section aria-labelledby="lobby-titulo">
      <h2 id="lobby-titulo" className="text-xl font-black">
        Lobby geral · {players.length} {players.length === 1 ? "pessoa" : "pessoas"}
      </h2>
      <div className="mt-3" role="group" aria-label="Quantidade de equipes">
        <p className="mb-1 text-sm font-bold" aria-hidden="true">
          Quantas equipes?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[2, 3, 4].map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={teamCount === count}
              className={`min-h-12 cursor-pointer rounded-2xl border-2 text-lg font-black ${
                teamCount === count ? "border-gold bg-gold text-espresso" : "border-cream/25 bg-espresso/60"
              }`}
              onClick={() => setTeamCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <p role="status" className="mt-3 text-sm font-bold text-gold">
        Escolha os capitães: {captains.length} de {teamCount}. Os demais serão sorteados entre as equipes.
      </p>
      {players.length === 0 ? (
        <p className="mt-3 rounded-2xl border-2 border-dashed border-cream/30 p-6 text-center font-bold">
          Compartilhe o convite. As pessoas aparecem aqui assim que entrarem.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {players.map((player) => {
            const order = captains.indexOf(player.id);
            return (
              <li key={player.id}>
                <MemberCard
                  member={player}
                  selected={order >= 0}
                  disabled={order < 0 && captains.length >= teamCount}
                  note={order >= 0 ? `Capitão ${order + 1}` : ""}
                  onSelect={() =>
                    setPicked(order >= 0 ? captains.filter((id) => id !== player.id) : [...captains, player.id])
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4">
        <ConfirmButton
          className="btn btn-primary w-full text-lg"
          confirmLabel="Confirmar sorteio"
          disabled={busy || captains.length !== teamCount}
          onConfirm={() => void commands.run("form_teams", { captainIds: captains })}
        >
          Sortear {teamCount} equipes
        </ConfirmButton>
        <p className="mt-2 text-center text-xs text-cream/75">
          Ao sortear, as entradas se fecham. Dá para refazer a divisão antes de começar a partida.
        </p>
      </div>
    </section>
  );
}

function EconomyForm({ snapshot, commands, allReady }: Props & { allReady: boolean }) {
  const { totalChocolates, initialPerTeam } = snapshot.room;
  const [total, setTotal] = useState(totalChocolates?.toString() ?? "");
  const [initial, setInitial] = useState(initialPerTeam?.toString() ?? "");
  const teams = snapshot.teams.length;
  const valid = /^\d{1,5}$/.test(total) && /^\d{1,5}$/.test(initial);
  const plan = valid ? planEconomy(Number(total), Number(initial), teams) : null;
  const saved = valid && Number(total) === totalChocolates && Number(initial) === initialPerTeam;

  return (
    <form
      className="panel p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) void commands.run("set_economy", { total: Number(total), initialPerTeam: Number(initial) });
      }}
    >
      <h3 className="text-lg font-black">Bombons</h3>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="block text-sm font-bold">
          Total disponível
          <input className="field mt-1" inputMode="numeric" pattern="\d*" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
        <label className="block text-sm font-bold">
          Iniciais por equipe
          <input className="field mt-1" inputMode="numeric" pattern="\d*" value={initial} onChange={(e) => setInitial(e.target.value)} />
        </label>
      </div>
      {plan && (
        <dl className="mt-3 grid gap-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt>
              Saldo inicial total ({teams} × {plan.initialPerTeam})
            </dt>
            <dd className="font-black">{plan.initialTotal}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Reserva das cartas de bônus (8×2 + 4×4)</dt>
            <dd className="font-black">{plan.bonusReserve}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Limite da soma das maletas positivas</dt>
            <dd className="font-black">{plan.gainBudget}</dd>
          </div>
        </dl>
      )}
      {plan && !plan.ok && (
        <p role="alert" className="mt-2 rounded-xl border border-[#ff9d9d] bg-[#4a1214] p-3 text-sm font-bold">
          Não cabe: as maletas de ganho precisam de pelo menos {plan.minGainBudget} bombons. Aumente o total para{" "}
          {plan.minTotal} ou mais
          {plan.maxInitialPerTeam >= 0 ? ` ou reduza o saldo inicial para no máximo ${plan.maxInitialPerTeam}` : ""}.
        </p>
      )}
      <button type="submit" className="btn btn-gold mt-3 w-full" disabled={!valid || saved || commands.pending !== null}>
        {saved ? "✓ Configuração salva" : "Salvar configuração"}
      </button>
      <div className="mt-3">
        <ConfirmButton
          className="btn btn-primary w-full text-lg"
          confirmLabel="Confirmar: começar e fixar as 60 maletas"
          disabled={!allReady || !saved || !plan?.ok || commands.pending !== null}
          onConfirm={() => void commands.run("start_match")}
        >
          Começar a partida
        </ConfirmButton>
        {(!allReady || !saved) && (
          <p className="mt-2 text-center text-xs font-bold text-blush">
            {!allReady ? "Falta fábrica confirmar. " : ""}
            {!saved ? "Salve a configuração dos bombons." : ""}
          </p>
        )}
      </div>
    </form>
  );
}

export function FactoriesStage({ snapshot, commands }: Props) {
  const teams = teamViews(snapshot);
  const allReady = teams.every((team) => team.ready);
  return (
    <section aria-labelledby="fabricas-titulo" className="grid gap-4">
      <h2 id="fabricas-titulo" className="text-xl font-black">
        Fábricas prontas: {teams.filter((team) => team.ready).length} de {teams.length}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {teams.map((team) => (
          <li key={team.id} className="min-w-0 rounded-[1.9rem] border-2 p-1" style={{ borderColor: teamColor(team.slot) }}>
            <FactoryCard factory={team} captainName={team.captain?.name ?? ""} placeholder={`Fábrica ${team.slot}`}>
              <p className={`mt-1 text-sm font-black ${team.ready ? "text-[#7ee29c]" : "text-gold"}`}>
                {team.ready ? "✓ Pronta" : "Personalizando…"}
              </p>
              <p className="mt-1 text-xs text-cream/80">{team.members.map((m) => memberName(m)).join(" · ")}</p>
            </FactoryCard>
          </li>
        ))}
      </ul>
      <EconomyForm snapshot={snapshot} commands={commands} allReady={allReady} />
      <ConfirmButton
        className="btn btn-ghost w-full text-sm"
        confirmLabel="Confirmar: desfazer as equipes"
        disabled={commands.pending !== null}
        onConfirm={() => void commands.run("reset_teams")}
      >
        Refazer a divisão
      </ConfirmButton>
    </section>
  );
}
