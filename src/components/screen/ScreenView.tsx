"use client";

/**
 * Telão: somente leitura, com imagens grandes, pouco texto e foco no momento
 * atual. Usa apenas o estado público; não consulta espionagens.
 */
/* eslint-disable @next/next/no-img-element */
import { Avatar } from "@/components/mascot/Avatar";
import { InviteQr, useOrigin } from "@/components/moderator/InvitePanel";
import { ConnectionBadge } from "@/components/room/Feedback";
import { FinalStandings, Scoreboard } from "@/components/room/Scoreboard";
import { CaseBoard } from "@/components/stage/CaseBoard";
import { CaseTable } from "@/components/stage/CaseTable";
import { ChocolateWave } from "@/components/ui/ChocolateWave";
import { FitName } from "@/components/ui/FitName";
import { asset } from "@/lib/assets";
import { teamColor } from "@/lib/catalog";
import { shareUrl } from "@/lib/room/links";
import {
  eventText,
  inPlayOrder,
  memberName,
  POWER_LABELS,
  stageLabel,
  teamOnTurn,
  teamViews,
  type TeamView,
} from "@/lib/room/model";
import type { Snapshot } from "@/lib/room/types";
import type { Room } from "@/lib/room/useRoom";

function headline(snapshot: Snapshot): string {
  const { status, stage } = snapshot.room;
  const last = snapshot.history[0];
  if (status === "lobby") return "Entre na sala!";
  if (status === "factories") return "As fábricas estão chegando";
  if (status === "ended") return "Partida encerrada!";
  switch (stage!) {
    case "representatives":
      return "Quem vai batalhar pelas cartas?";
    case "battle":
      return "Batalha pelas cartas!";
    case "preparation":
      return last && ["register_combo", "spy_used"].includes(last.type) ? eventText(last, snapshot) : "Preparação";
    case "picking": {
      const turn = teamOnTurn(snapshot);
      return turn ? `Vez de ${turn.label}` : "Maletas na mesa!";
    }
    case "interference":
      return last ? eventText(last, snapshot) : "Maletas abertas!";
    case "review":
      return "Conferindo os resultados";
    case "paid":
      return "Bombons pagos!";
  }
}

function Lobby({ snapshot }: { snapshot: Snapshot }) {
  const origin = useOrigin();
  const players = snapshot.members.filter((member) => member.kind === "player");
  const url = origin ? shareUrl(origin, "entrar", snapshot.room.code) : "";
  return (
    <div className="grid h-full items-center gap-[2vw] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="panel flex flex-col items-center gap-[1.5vh] p-[1.5vw] text-center">
        {url && <InviteQr url={url} className="w-full max-w-[min(26vw,46vh)] max-md:max-w-60" />}
        <p className="text-[clamp(0.9rem,1.3vw,1.6rem)] font-bold">Aponte a câmera ou entre com o código</p>
        <p className="font-display text-[clamp(2.5rem,5.5vw,7rem)] leading-none tracking-[0.18em] text-gold">
          {snapshot.room.code}
        </p>
        <p className="text-[clamp(0.7rem,0.9vw,1.1rem)] break-all text-cream/75">{url}</p>
      </div>
      <div className="min-w-0">
        <p className="mb-[1.5vh] text-center text-[clamp(1.1rem,1.8vw,2.4rem)] font-black">
          {players.length === 0
            ? "Esperando a turma chegar…"
            : `${players.length} ${players.length === 1 ? "pessoa" : "pessoas"} na sala`}
        </p>
        <ul className="flex flex-wrap justify-center gap-[1vw]">
          {players.map((player) => (
            <li key={player.id} className="factory-pop flex w-[clamp(5rem,7.5vw,9rem)] flex-col items-center">
              <Avatar look={player.look} className="size-[clamp(4rem,6vw,7rem)]" />
              <FitName className="mt-1 text-center text-[clamp(0.85rem,1.1vw,1.4rem)] font-extrabold">{player.name}</FitName>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Factories({ snapshot, teams }: { snapshot: Snapshot; teams: TeamView[] }) {
  const { status, stage } = snapshot.room;
  // Antes do início da batalha, o telão não antecipa quem foi indicado.
  const showRepresentative = stage === "battle" || stage === "preparation";
  return (
    <ul className={`grid h-full gap-[1.4vw] ${teams.length === 2 ? "grid-cols-2" : teams.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
      {teams.map((team) => {
        const representative = showRepresentative
          ? team.members.find((member) => member.id === team.round?.representativeId)
          : undefined;
        const combo = snapshot.powers.find((use) => use.teamId === team.id && use.category === "combo");
        return (
          <li
            key={team.id}
            className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border-4 bg-chocolate shadow-panel"
            style={{ borderColor: teamColor(team.slot) }}
          >
            <div className={`fundo-${team.background} relative min-h-32 flex-1`}>
              <img
                src={asset(`/assets/fabricas/${team.model}.webp`)}
                alt=""
                className="factory-pop absolute inset-x-[4%] bottom-[4%] h-[88%] w-[92%] object-contain object-bottom"
              />
            </div>
            <div className="flex flex-col items-center gap-[0.8vh] px-2 py-[1.4vh] text-center">
              <h2 className="gold-text w-full">
                <FitName className="text-[clamp(1.25rem,2.3vw,3rem)] leading-tight" min={18}>
                  {team.label}
                </FitName>
              </h2>
              {representative ? (
                <div className="factory-pop flex w-full items-center justify-center gap-2">
                  <Avatar look={representative.look} className="size-[clamp(3.5rem,6vw,7rem)]" />
                  <span className="min-w-0 flex-1 text-left">
                    <FitName className="text-[clamp(1.1rem,1.9vw,2.4rem)] leading-tight font-black" min={16}>
                      {memberName(representative)}
                    </FitName>
                  </span>
                </div>
              ) : (
                <div className="w-full">
                  <p className="text-[clamp(0.65rem,0.8vw,1rem)] font-black tracking-[0.18em] text-blush uppercase">Capitão</p>
                  <FitName className="text-[clamp(1rem,1.5vw,2rem)] leading-tight font-bold">
                    {team.captain?.name ?? "—"}
                  </FitName>
                </div>
              )}
              {status === "factories" && (
                <p className={`text-[clamp(0.9rem,1.2vw,1.5rem)] font-black ${team.ready ? "text-[#7ee29c]" : "text-gold"}`}>
                  {team.ready ? "✓ Pronta" : "Personalizando…"}
                </p>
              )}
              {stage === "preparation" && combo && (
                <p className="bonus-flash rounded-full border border-gold/60 bg-gold/15 px-3 py-0.5 text-[clamp(0.8rem,1.1vw,1.4rem)] font-black text-gold">
                  {POWER_LABELS[combo.power]}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Picking({ snapshot, teams }: { snapshot: Snapshot; teams: TeamView[] }) {
  const turn = teamOnTurn(snapshot);
  return (
    <div className="flex h-full flex-col gap-[2vh]">
      <CaseBoard
        snapshot={snapshot}
        teams={teams}
        className="min-h-0 flex-1 grid-cols-6 md:grid-cols-12 lg:auto-rows-fr"
      />
      <ul className="grid grid-cols-2 gap-[1vw] md:grid-cols-4">
        {inPlayOrder(teams).map((team) => (
          <li
            key={team.id}
            className={`flex min-w-0 items-center gap-3 rounded-2xl border-4 bg-chocolate px-3 py-1 ${
              turn?.id === team.id ? "shadow-[0_0_0_4px_#efc879,0_0_28px_#efc879]" : ""
            }`}
            style={{ borderColor: teamColor(team.slot) }}
          >
            <img src={asset(`/assets/fabricas/${team.model}.webp`)} alt="" className="h-[8vh] max-h-24 w-auto" />
            <span className="min-w-0 flex-1 text-[clamp(0.9rem,1.4vw,1.9rem)] font-black">
              <FitName className="leading-tight" min={14}>{`${team.round?.playPosition}º · ${team.label}`}</FitName>
              <span className="font-display text-[1.4em] font-normal text-gold">
                {team.round?.caseNumber ? `Maleta ${team.round.caseNumber}` : turn?.id === team.id ? "escolhendo…" : "aguarda"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScreenView({ room }: { room: Room & { snapshot: Snapshot } }) {
  const { snapshot } = room;
  const { status, stage, round, maxRounds } = snapshot.room;
  const teams = teamViews(snapshot);
  const title = headline(snapshot);
  const showTable = stage === "interference" || stage === "review" || stage === "paid";

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  return (
    <div className="relative isolate flex min-h-svh flex-col gap-[1.4vh] px-[2vw] pt-[1.2vh] pb-[max(1vh,env(safe-area-inset-bottom))] lg:h-svh">
      <ChocolateWave className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[11vh] w-full" />
      <header className="text-center">
        <p className="mx-auto w-fit max-w-full rounded-[2rem] border border-gold/40 bg-espresso/90 px-[1.6vw] py-[0.3vh] font-display text-[clamp(1rem,1.8vw,2.4rem)] text-gold uppercase">
          Dominação Chocolatosa <span className="text-[#ff5aa6]">· Topa ou Arrisca?</span>
        </p>
        <p className="text-[clamp(0.65rem,0.85vw,1.1rem)] font-extrabold tracking-[0.4em] text-gold uppercase [text-shadow:0_1px_2px_#000,0_0_8px_#000]">
          Atmosfera Jovem
        </p>
        {status === "playing" && (
          <p className="mt-[0.6vh] text-[clamp(1rem,1.5vw,2rem)] font-black">
            Rodada {round} de {maxRounds} · {stageLabel(snapshot)}
          </p>
        )}
        <div role="status">
          <h1
            // Anima só quando a frase muda, não a cada atualização.
            key={title}
            className="factory-pop mt-[0.4vh] font-display text-[clamp(1.6rem,min(3.1vw,5.4vh),4.5rem)] leading-tight text-balance text-cream [text-shadow:0_4px_0_#7d0a42,0_6px_18px_#000]"
          >
            {title}
          </h1>
        </div>
      </header>

      {/* Se algum dia faltar altura, a área rola em vez de cobrir o placar. */}
      <main className="min-h-0 flex-1 lg:overflow-x-hidden lg:overflow-y-auto" tabIndex={0} aria-label="Acontecimentos da partida">
        {status === "lobby" ? (
          <Lobby snapshot={snapshot} />
        ) : status === "ended" ? (
          <div className="mx-auto max-w-[min(100%,80vw)] pt-[1vh]">
            <FinalStandings snapshot={snapshot} tv />
          </div>
        ) : showTable ? (
          <CaseTable snapshot={snapshot} tv />
        ) : stage === "picking" ? (
          <Picking snapshot={snapshot} teams={teams} />
        ) : (
          <Factories snapshot={snapshot} teams={inPlayOrder(teams)} />
        )}
      </main>

      {status === "playing" && <Scoreboard snapshot={snapshot} tv />}

      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-cream/75">
        <span className="font-extrabold tracking-widest">SALA {snapshot.room.code} · SOMENTE LEITURA</span>
        <span className="flex items-center gap-2">
          <ConnectionBadge room={room} />
          <button type="button" className="btn btn-ghost min-h-11! px-4! py-1! text-xs" onClick={toggleFullscreen}>
            Tela cheia
          </button>
        </span>
      </footer>
    </div>
  );
}
