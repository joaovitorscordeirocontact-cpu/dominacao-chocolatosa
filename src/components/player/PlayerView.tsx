"use client";

import { useState } from "react";
import { CharacterEditor } from "@/components/character/CharacterEditor";
import { FactoryCard } from "@/components/factory/FactoryCard";
import { Avatar } from "@/components/mascot/Avatar";
import { CommandFeedback, ConnectionBadge, ConnectionWarning } from "@/components/room/Feedback";
import { MemberCard } from "@/components/room/MemberCard";
import { FinalStandings, Scoreboard } from "@/components/room/Scoreboard";
import { CaseBoard } from "@/components/stage/CaseBoard";
import { CaseTable } from "@/components/stage/CaseTable";
import { ChocolateWave } from "@/components/ui/ChocolateWave";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { FitName } from "@/components/ui/FitName";
import { ActionBar } from "@/components/ui/Screen";
import { teamColor } from "@/lib/catalog";
import { saveProfile } from "@/lib/profile-store";
import { inPlayOrder, memberName, POWER_LABELS, stageLabel, teamOnTurn, teamViews, type TeamView } from "@/lib/room/model";
import type { Member, Snapshot } from "@/lib/room/types";
import { useCommand, type Commands } from "@/lib/room/useCommand";
import type { Room } from "@/lib/room/useRoom";
import type { Profile } from "@/lib/types";
import { CaptainFactory } from "./FactoryStage";
import { SpyPanel } from "./SpyPanel";

type Props = { room: Room & { snapshot: Snapshot } };

function Guidance({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div role="status" className="panel p-4 text-center">
      <h2 className="gold-text text-2xl leading-tight">{title}</h2>
      {children && <div className="mt-1 text-sm font-bold text-cream/90">{children}</div>}
    </div>
  );
}

function People({ members, note }: { members: Member[]; note?: (member: Member) => string }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {members.map((member) => (
        <li key={member.id}>
          <MemberCard member={member} note={note?.(member) ?? ""} />
        </li>
      ))}
    </ul>
  );
}

function EditMascot({ room, me, commands, onClose }: Props & { me: Member; commands: Commands; onClose: () => void }) {
  const [draft, setDraft] = useState<Profile>({ name: me.name, ...me.look });
  async function save() {
    const { name, ...look } = draft;
    if (await commands.run("set_look", { name, look })) {
      saveProfile(draft);
      onClose();
    }
  }
  return (
    <main className="safe-x mx-auto w-full max-w-5xl pt-[max(0.75rem,env(safe-area-inset-top))]">
      <CommandFeedback commands={commands} />
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn btn-ghost min-h-11! px-4! py-1! text-sm" onClick={onClose}>
          <span aria-hidden="true">←</span> Voltar
        </button>
        <ConnectionBadge room={room} />
      </div>
      <h1 className="gold-text my-3 text-center text-3xl">Seu mascote</h1>
      <CharacterEditor
        profile={draft}
        onChange={setDraft}
        footer={
          <button
            type="button"
            className="btn btn-primary text-lg"
            disabled={!draft.name.trim() || commands.pending !== null}
            onClick={() => void save()}
          >
            Salvar mascote
          </button>
        }
      />
    </main>
  );
}

function Representatives({ snapshot, team, commands }: { snapshot: Snapshot; team: TeamView; commands: Commands }) {
  const captain = snapshot.me.isCaptain;
  const selected = team.round?.representativeId ?? null;
  const chosen = team.members.find((member) => member.id === selected);
  return (
    <>
      <Guidance title={captain ? "Quem vai batalhar pelas cartas?" : "Escolha do representante"}>
        {captain
          ? "Toque em alguém. Dá para trocar até o moderador iniciar a batalha."
          : selected === snapshot.me.memberId
            ? "Você foi indicado para representar a fábrica!"
            : "A liderança está escolhendo. Conversem!"}
        <p className="mt-1 text-xs text-cream/75">
          O número acima de cada pessoa é a quantidade de batalhas já disputadas. Repetir é permitido.
        </p>
      </Guidance>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {team.members.map((member) => (
          <li key={member.id}>
            <MemberCard
              member={member}
              showBattles
              selected={member.id === selected}
              disabled={commands.pending !== null}
              note={
                member.id === selected
                  ? "✓ Representante"
                  : member.id === snapshot.me.memberId
                    ? "Você"
                    : member.isCaptain
                      ? "Capitão"
                      : ""
              }
              onSelect={captain ? () => void commands.run("select_representative", { memberId: member.id }) : undefined}
            />
          </li>
        ))}
      </ul>
      <p role="status" className="mt-3 text-center text-sm font-bold text-gold">
        {chosen ? `${chosen.name} vai representar a fábrica.` : "Ninguém indicado ainda."}
      </p>
    </>
  );
}

function Competitors({ snapshot }: { snapshot: Snapshot }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      {teamViews(snapshot).map((team) => {
        const member = snapshot.members.find((item) => item.id === team.round?.representativeId);
        return (
          <li
            key={team.id}
            className="flex min-w-0 flex-col items-center rounded-2xl border-2 border-t-8 bg-chocolate p-2 text-center"
            style={{ borderColor: teamColor(team.slot) }}
          >
            <FitName className="text-xs font-extrabold text-blush">{team.label}</FitName>
            {member && <Avatar look={member.look} className="factory-pop my-1 size-20" />}
            <FitName className="font-black">{memberName(member)}</FitName>
          </li>
        );
      })}
    </ul>
  );
}

function OrderList({ snapshot }: { snapshot: Snapshot }) {
  const teams = inPlayOrder(teamViews(snapshot));
  const turn = teamOnTurn(snapshot);
  return (
    <ol className="mt-3 grid gap-2 sm:grid-cols-2">
      {teams.map((team) => {
        const combo = snapshot.powers.find((use) => use.teamId === team.id && use.category === "combo");
        return (
          <li
            key={team.id}
            className={`flex min-w-0 items-center gap-2 rounded-2xl border-2 border-l-8 bg-chocolate/90 px-3 py-2 ${
              turn?.id === team.id ? "shadow-[0_0_0_3px_#efc879]" : ""
            }`}
            style={{ borderColor: teamColor(team.slot) }}
          >
            <span className="gold-text shrink-0 text-xl">{team.round?.playPosition}º</span>
            <span className="min-w-0 flex-1">
              <FitName className="leading-tight font-extrabold">{team.label}</FitName>
              <span className="block text-xs text-cream/80">
                {team.round?.caseNumber
                  ? `Maleta ${team.round.caseNumber}`
                  : turn?.id === team.id
                    ? "É a vez!"
                    : combo
                      ? POWER_LABELS[combo.power]
                      : "Aguardando"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Picking({ snapshot, team, commands }: { snapshot: Snapshot; team: TeamView; commands: Commands }) {
  const [selected, setSelected] = useState<number | null>(null);
  const turn = teamOnTurn(snapshot);
  const myTurn = turn?.id === team.id && snapshot.me.isCaptain;
  const still = snapshot.cases[(selected ?? 0) - 1]?.state === "available" ? selected : null;
  return (
    <>
      <Guidance
        title={
          myTurn
            ? "Sua vez: escolha uma maleta"
            : team.round?.caseNumber
              ? `Sua fábrica está com a maleta ${team.round.caseNumber}`
              : turn
                ? `Vez de ${turn.label}`
                : "Todas as maletas foram escolhidas"
        }
      >
        {!turn
          ? "Aguardem o moderador abrir as maletas."
          : turn.id === team.id && !myTurn
            ? "É a vez da sua fábrica! A liderança escolhe."
            : "Maletas escolhidas continuam fechadas até a revelação."}
      </Guidance>
      <OrderList snapshot={snapshot} />
      <div className="mt-4">
        <CaseBoard
          snapshot={snapshot}
          teams={teamViews(snapshot)}
          selected={myTurn ? still : null}
          disabled={commands.pending !== null}
          onSelect={myTurn ? setSelected : undefined}
        />
      </div>
      {myTurn && (
        <ActionBar>
          {still === null ? (
            <p className="rounded-2xl bg-espresso/95 px-3 py-2 text-sm font-bold">Toque numa maleta do painel.</p>
          ) : (
            <ConfirmButton
              key={still}
              className="btn btn-primary text-lg"
              confirmLabel={`Confirmar a maleta ${still}`}
              disabled={commands.pending !== null}
              onConfirm={() => void commands.run("pick_case", { number: still })}
            >
              Escolher a maleta {still}
            </ConfirmButton>
          )}
        </ActionBar>
      )}
    </>
  );
}

function StageContent({ room, team, commands }: Props & { team: TeamView | undefined; commands: Commands }) {
  const { snapshot } = room;
  const { status, stage } = snapshot.room;
  const players = snapshot.members.filter((member) => member.kind === "player");

  if (status === "lobby") {
    return (
      <>
        <Guidance title="Você entrou na sala!">
          Aguarde o moderador formar as equipes. Enquanto isso, capriche no mascote.
        </Guidance>
        <h3 className="mt-4 mb-2 font-black">No lobby ({players.length})</h3>
        <People members={players} note={(m) => (m.id === snapshot.me.memberId ? "Você" : "")} />
      </>
    );
  }
  if (status === "ended") {
    return (
      <>
        <Guidance title="Partida encerrada!">Obrigado por jogar.</Guidance>
        <div className="mt-4">
          <FinalStandings snapshot={snapshot} />
        </div>
      </>
    );
  }
  if (!team) {
    return (
      <Guidance title="Aguardando uma equipe">
        As equipes já foram formadas. O moderador precisa colocar você numa delas.
      </Guidance>
    );
  }
  if (status === "factories") {
    if (snapshot.me.isCaptain) {
      return (
        <>
          <Guidance title="Montem a fábrica">Você lidera. Decidam juntos o nome, o modelo e o fundo.</Guidance>
          <div className="mt-3">
            <CaptainFactory key={team.id} roomId={snapshot.room.id} team={team} commands={commands} refresh={room.refresh} />
          </div>
        </>
      );
    }
    return (
      <>
        <Guidance title={team.ready ? "Fábrica pronta!" : "A liderança está montando a fábrica"}>
          Acompanhe aqui e opine com sua equipe.
        </Guidance>
        <div className="mx-auto mt-3 max-w-md">
          <FactoryCard factory={team} captainName={team.captain?.name ?? ""} placeholder="Nome em escolha…" />
        </div>
        <h3 className="mt-4 mb-2 font-black">Sua equipe</h3>
        <People
          members={team.members}
          note={(m) => (m.isCaptain ? "Capitão" : m.id === snapshot.me.memberId ? "Você" : "")}
        />
      </>
    );
  }

  switch (stage!) {
    case "representatives":
      return <Representatives snapshot={snapshot} team={team} commands={commands} />;
    case "battle":
      return (
        <>
          <Guidance
            title={team.round?.representativeId === snapshot.me.memberId ? "Você vai batalhar!" : "Batalha pelas cartas!"}
          >
            A disputa é presencial. As cartas são físicas.
          </Guidance>
          <Competitors snapshot={snapshot} />
        </>
      );
    case "preparation":
      return (
        <>
          <Guidance title="Preparação">
            Para usar uma combinação (duas cartas numéricas da mesma cor), anunciem ao moderador. Uma por rodada.
          </Guidance>
          <OrderList snapshot={snapshot} />
        </>
      );
    case "picking":
      return <Picking key={snapshot.room.round} snapshot={snapshot} team={team} commands={commands} />;
    default: {
      const titles = {
        interference: "Maletas abertas!",
        review: "Conferência",
        paid: "Bombons pagos!",
      } as const;
      const hints = {
        interference: "Resultados provisórios. Cartas especiais são anunciadas e registradas pelo moderador.",
        review: "O moderador está conferindo antes de pagar.",
        paid: "Aguardem a próxima rodada.",
      } as const;
      return (
        <>
          <Guidance title={titles[stage as keyof typeof titles]}>{hints[stage as keyof typeof hints]}</Guidance>
          <div className="mt-3">
            <CaseTable snapshot={snapshot} />
          </div>
        </>
      );
    }
  }
}

export function PlayerView({ room }: Props) {
  const { snapshot } = room;
  const commands = useCommand(snapshot.room.id, room.refresh);
  const [editing, setEditing] = useState(false);
  const me = snapshot.members.find((member) => member.id === snapshot.me.memberId)!;
  const teams = teamViews(snapshot);
  const team = teams.find((option) => option.id === snapshot.me.teamId);
  const inMatch = snapshot.room.status === "playing";

  if (editing) return <EditMascot room={room} me={me} commands={commands} onClose={() => setEditing(false)} />;

  return (
    <div className="relative min-h-svh">
      <ChocolateWave className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-20 w-full" />
      <CommandFeedback commands={commands} />
      <main className="safe-x mx-auto w-full max-w-5xl pt-[max(0.75rem,env(safe-area-inset-top))] pb-8">
        <header className="mb-3">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-espresso/85 px-3 py-1 text-xs font-extrabold tracking-widest">
              SALA {snapshot.room.code}
            </span>
            <ConnectionBadge room={room} />
          </div>
          <div className="panel mt-2 flex items-center gap-3 p-2">
            <Avatar look={me.look} className="size-14" />
            <div className="min-w-0 flex-1">
              <FitName className="text-lg leading-tight font-black">{me.name}</FitName>
              {team && (
                <span className="block border-l-4 pl-2" style={{ borderColor: teamColor(team.slot) }}>
                  <FitName className="text-sm leading-tight font-bold text-blush">{team.label}</FitName>
                </span>
              )}
              {snapshot.me.isCaptain && <span className="text-xs font-black text-gold uppercase">Capitão</span>}
            </div>
            <button type="button" className="btn btn-ghost min-h-11! shrink-0 px-3! py-1! text-xs" onClick={() => setEditing(true)}>
              Mascote
            </button>
          </div>
          <h1 className="mt-3 text-center text-base font-black">
            {inMatch && (
              <span className="block text-gold">
                Rodada {snapshot.room.round} de {snapshot.room.maxRounds}
              </span>
            )}
            {stageLabel(snapshot)}
          </h1>
        </header>

        <ConnectionWarning room={room} />
        {/* A chave só muda quando a ETAPA muda: atualizações não reanimam a tela. */}
        <div key={`${snapshot.room.status}-${snapshot.room.stage}-${snapshot.room.round}`} className="screen-enter">
          <StageContent room={room} team={team} commands={commands} />
        </div>

        {inMatch && snapshot.me.isCaptain && team && (
          <SpyPanel snapshot={snapshot} teams={teams} refresh={room.refresh} />
        )}

        {inMatch && (
          <div className="mt-5">
            <h2 className="mb-2 font-black">Placar</h2>
            <Scoreboard snapshot={snapshot} mine={snapshot.me.teamId} />
          </div>
        )}
      </main>
    </div>
  );
}
