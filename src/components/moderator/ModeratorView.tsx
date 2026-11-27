"use client";

import { useState } from "react";
import { Avatar } from "@/components/mascot/Avatar";
import { CommandFeedback, ConnectionBadge, ConnectionWarning } from "@/components/room/Feedback";
import { FinalStandings, Scoreboard } from "@/components/room/Scoreboard";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { FitName } from "@/components/ui/FitName";
import { teamColor } from "@/lib/catalog";
import {
  chocolates,
  eventText,
  memberName,
  signed,
  STAGE_LABELS,
  stageLabel,
  teamViews,
  type TeamView,
} from "@/lib/room/model";
import type { Member, RoundStage as Stage, Snapshot } from "@/lib/room/types";
import { useCommand, type Commands } from "@/lib/room/useCommand";
import type { Room } from "@/lib/room/useRoom";
import { InvitePanel } from "./InvitePanel";
import { FactoriesStage, LobbyStage } from "./LobbyStages";
import { RoundStage } from "./RoundStages";

type Props = { snapshot: Snapshot; commands: Commands };

function Steps({ stage }: { stage: Stage }) {
  const all = Object.keys(STAGE_LABELS) as Stage[];
  const current = all.indexOf(stage);
  return (
    <ol className="mt-2 grid grid-cols-7 gap-1" aria-label="Etapas da rodada">
      {all.map((item, index) => (
        <li
          key={item}
          aria-current={index === current ? "step" : undefined}
          className={`h-2 rounded-full ${index < current ? "bg-gold" : index === current ? "bg-pink" : "bg-cream/20"}`}
        >
          <span className="sr-only">{STAGE_LABELS[item]}</span>
        </li>
      ))}
    </ol>
  );
}

function Panel({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="panel p-3" open={open}>
      <summary className="min-h-11 cursor-pointer content-center text-lg font-black">{title}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

/** Controles de uma pessoa: colocar numa equipe, tornar capitã ou remover. */
function PersonRow({ member, snapshot, commands, teams }: Props & { member: Member; teams: TeamView[] }) {
  const team = teams.find((item) => item.id === member.teamId);
  const busy = commands.pending !== null;
  const status = snapshot.room.status;
  const smallest = Math.min(...teams.map((item) => item.members.length));
  const waiting = member.kind === "player" && !team && (status === "factories" || status === "playing");
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-xl bg-espresso/60 p-2">
      <div className="flex items-center gap-2">
        {member.kind === "player" ? (
          <Avatar look={member.look} className="size-11" />
        ) : (
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-gold font-black">
            TV
          </span>
        )}
        <span className="min-w-0 flex-1">
          <FitName className="leading-tight font-extrabold">
            {member.kind === "screen" ? "Telão" : memberName(member)}
          </FitName>
          {team && (
            <span className="block border-l-4 pl-1 text-xs" style={{ borderColor: teamColor(team.slot) }}>
              <FitName className="text-xs">
                {`${team.label}${member.isCaptain ? " · capitão" : ""} · ${member.battles} bat.`}
              </FitName>
            </span>
          )}
          {waiting && <span className="text-xs font-black text-gold">Aguardando equipe</span>}
        </span>
        {status !== "ended" && !waiting && (member.kind === "screen" || !team || !member.isCaptain) && (
          <button
            type="button"
            className="btn btn-ghost min-h-11! shrink-0 px-3! py-1! text-xs"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            Opções
          </button>
        )}
      </div>
      {waiting && (
        <div className="mt-2 grid gap-2">
          {teams
            .filter((item) => item.members.length === smallest)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className="btn btn-gold min-h-11! text-xs"
                disabled={busy}
                onClick={() => void commands.run("assign_member", { memberId: member.id, teamId: item.id })}
              >
                Colocar em {item.label}
              </button>
            ))}
          <ConfirmButton
            className="btn btn-ghost min-h-11! text-xs"
            confirmLabel={`Remover ${memberName(member)}`}
            disabled={busy}
            onConfirm={() => void commands.run("remove_member", { memberId: member.id })}
          >
            Remover da sala
          </ConfirmButton>
        </div>
      )}
      {open && !waiting && (
        <div className="mt-2">
          {team && !member.isCaptain && (
            <ConfirmButton
              className="btn btn-ghost min-h-11! w-full text-xs"
              confirmLabel={`Passar a liderança para ${memberName(member)}`}
              disabled={busy}
              onConfirm={() => void commands.run("set_captain", { teamId: team.id, memberId: member.id })}
            >
              Tornar capitão (se o aparelho do capitão falhar)
            </ConfirmButton>
          )}
          {!team && (
            <ConfirmButton
              className="btn btn-ghost min-h-11! w-full text-xs"
              confirmLabel="Confirmar remoção"
              disabled={busy}
              onConfirm={() => void commands.run("remove_member", { memberId: member.id })}
            >
              Remover da sala
            </ConfirmButton>
          )}
        </div>
      )}
    </li>
  );
}

function PaymentHistory({ snapshot }: { snapshot: Snapshot }) {
  const teams = teamViews(snapshot);
  const rounds = [...new Set(snapshot.payments.map((payment) => payment.round))].reverse();
  if (!rounds.length) return <p className="text-sm">Nenhum pagamento ainda.</p>;
  return (
    <ol className="grid gap-2">
      {rounds.map((round) => (
        <li key={round} className="rounded-xl bg-espresso/60 p-2 text-sm">
          <strong>Rodada {round}</strong>
          <ul>
            {snapshot.payments
              .filter((payment) => payment.round === round)
              .map((payment) => (
                <li key={payment.teamId}>
                  {teams.find((team) => team.id === payment.teamId)?.label}: {payment.startBalance} →{" "}
                  <strong>{payment.finalBalance}</strong> (maleta {payment.caseNumber}:{" "}
                  {signed(payment.effective)}, bônus {signed(payment.bonus)})
                </li>
              ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function ModeratorView({ room }: { room: Room & { snapshot: Snapshot } }) {
  const { snapshot } = room;
  const commands = useCommand(snapshot.room.id, room.refresh);
  const { status, stage, round, maxRounds } = snapshot.room;
  const teams = teamViews(snapshot);
  const people = snapshot.members.filter((member) => member.kind !== "moderator");
  const waiting = people.filter((m) => m.kind === "player" && !m.teamId && status !== "lobby");

  return (
    <main className="safe-x mx-auto w-full max-w-7xl pt-[max(0.75rem,env(safe-area-inset-top))] pb-10">
      <CommandFeedback commands={commands} />
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="rounded-full bg-espresso/85 px-3 py-1 text-xs font-extrabold tracking-widest">
            MODERAÇÃO · SALA {snapshot.room.code}
          </p>
          <ConnectionBadge room={room} />
        </div>
        <h1 className="gold-text mt-2 text-center text-2xl leading-tight sm:text-4xl">
          {status === "playing" ? `Rodada ${round} de ${maxRounds}` : stageLabel(snapshot)}
        </h1>
        {status === "playing" && (
          <>
            <p className="text-center text-sm font-black">{stageLabel(snapshot)}</p>
            <Steps stage={stage!} />
          </>
        )}
      </header>
      <ConnectionWarning room={room} />
      {waiting.length > 0 && (
        <p role="status" className="mb-3 rounded-2xl border-2 border-gold bg-gold/15 p-3 text-sm font-bold">
          {waiting.length === 1 ? "Há uma pessoa" : `Há ${waiting.length} pessoas`} sem equipe. Decida em “Pessoas”.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div key={`${status}-${stage}`} className="screen-enter min-w-0">
          {status === "lobby" && <LobbyStage snapshot={snapshot} commands={commands} />}
          {status === "factories" && <FactoriesStage snapshot={snapshot} commands={commands} />}
          {status === "playing" && <RoundStage snapshot={snapshot} commands={commands} />}
          {status === "ended" && (
            <section>
              <h2 className="mb-3 text-xl font-black">
                Classificação após {round} {round === 1 ? "rodada" : "rodadas"}
              </h2>
              <FinalStandings snapshot={snapshot} />
            </section>
          )}
          {status === "playing" && (
            <div className="mt-5">
              <h2 className="mb-2 font-black">Placar · estoque total: {chocolates(snapshot.room.totalChocolates ?? 0)}</h2>
              <Scoreboard snapshot={snapshot} />
            </div>
          )}
        </div>

        <aside className="grid min-w-0 grid-cols-1 gap-3" aria-label="Sala">
          <Panel key={status === "lobby" ? "convite-aberto" : "convite"} title="Convite e telão" open={status === "lobby"}>
            <InvitePanel snapshot={snapshot} commands={commands} />
          </Panel>
          <Panel
            key={waiting.length ? "pessoas-aberto" : "pessoas"}
            title={`Pessoas (${people.filter((m) => m.kind === "player").length})`}
            open={waiting.length > 0}
          >
            <ul className="grid gap-2">
              {people.map((member) => (
                <PersonRow key={member.id} member={member} snapshot={snapshot} commands={commands} teams={teams} />
              ))}
              {people.length === 0 && <li className="text-sm">Ninguém entrou ainda.</li>}
            </ul>
          </Panel>
          {snapshot.payments.length > 0 && (
            <Panel title="Pagamentos">
              <PaymentHistory snapshot={snapshot} />
            </Panel>
          )}
          <Panel title="Histórico">
            <ol className="grid max-h-96 gap-1 overflow-y-auto text-sm" tabIndex={0} aria-label="Histórico da sala">
              {snapshot.history.map((entry) => (
                <li key={entry.id} className="rounded-lg bg-espresso/60 px-2 py-1">
                  {entry.round > 0 && <span className="text-gold">R{entry.round} · </span>}
                  {eventText(entry, snapshot)}
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </main>
  );
}
