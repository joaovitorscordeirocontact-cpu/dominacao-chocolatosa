"use client";

import Link from "next/link";
import { FactoryScene } from "@/components/factory/FactoryScene";
import { FitName } from "@/components/ui/FitName";
import { ActionBar } from "@/components/ui/Screen";
import { confirmRepresentative, selectRepresentative } from "@/lib/battle";
import { TEAM_COLORS } from "@/lib/catalog";
import { buildTeams, USER_ID } from "@/lib/mock-data";
import { updateDemo, useDemoState, useHydrated } from "@/lib/store";
import { ParticipantCard } from "./ParticipantCard";

export function Lobby() {
  const state = useDemoState();
  const hydrated = useHydrated();
  const teams = buildTeams(state);
  const [team, ...others] = teams;
  const { battle, participation } = state;
  const selectedId = battle.representatives.t1;
  const selected = team.participants.find((participant) => participant.id === selectedId);
  const confirmed = battle.confirmed.t1;
  const captain = team.participants[0];

  return (
    <div className={`md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8 ${hydrated ? "" : "invisible"}`}>
      <div className="md:self-start">
        <figure className="overflow-hidden rounded-3xl border-2 border-gold/70 shadow-panel">
          <FactoryScene factory={team} className="aspect-16/10 md:aspect-4/3" />
          <figcaption className="border-t-2 border-gold/70 bg-chocolate px-4 py-3 text-center">
            <strong className="gold-text block font-normal">
              <FitName className="text-2xl leading-tight sm:text-3xl" min={18}>{team.name}</FitName>
            </strong>
            <span className="mt-1 block text-xs font-bold text-blush/80 uppercase">Capitão</span>
            <FitName className="text-base leading-tight font-bold text-blush">{captain.name}</FitName>
          </figcaption>
        </figure>

        <section aria-label="Outras fábricas da demonstração" className="mt-3 grid grid-cols-3 gap-2">
          {others.map((other) => (
            <figure key={other.id} className="overflow-hidden rounded-2xl border border-cream/15 bg-chocolate">
              <FactoryScene factory={other} />
              <figcaption
                className="border-t-4 px-1 py-1 text-center text-xs leading-tight font-extrabold"
                style={{ borderColor: TEAM_COLORS[other.id] }}
              >
                <FitName>{other.name}</FitName>
              </figcaption>
            </figure>
          ))}
        </section>
      </div>

      <section className="panel mt-4 p-3 sm:p-4 md:mt-0" aria-labelledby="equipe-titulo">
        <h2 id="equipe-titulo" className="text-lg font-black">
          {battle.started ? "Batalha em andamento" : "Quem vai batalhar pelas cartas?"}
        </h2>
        <p className="mt-1 text-sm text-cream/85">
          {battle.started
            ? "A escolha está travada até o moderador encerrar a batalha."
            : "Toque em um participante e confirme. O número acima de cada um é a quantidade de participações."}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {team.participants.map((participant) => (
            <ParticipantCard
              key={participant.id}
              participant={participant}
              count={participation[participant.id] ?? 0}
              selected={participant.id === selectedId}
              confirmed={confirmed}
              disabled={battle.started}
              isYou={participant.id === USER_ID}
              onSelect={() => updateDemo((current) => selectRepresentative(current, "t1", participant.id))}
            />
          ))}
        </div>
        <p className="mt-3 rounded-xl border border-dashed border-cream/30 px-3 py-2 text-xs font-bold text-cream/80">
          Demonstração local: os colegas são fictícios e nada é sincronizado entre celulares. A batalha começa quando
          você a confirma na visão do Moderador, neste aparelho.
        </p>
        {!confirmed && !battle.started && (
          <Link href="/palco" className="btn btn-ghost mt-3 w-full text-sm">
            Só ver o palco das maletas <span aria-hidden="true">→</span>
          </Link>
        )}
      </section>

      <ActionBar className="md:col-span-2">
        <p role="status" className="rounded-2xl border border-gold/25 bg-espresso/95 px-3 py-1.5 text-sm font-bold">
          {!selected
            ? "Nenhum representante selecionado."
            : battle.started
              ? `${selected.name} está na batalha.`
              : confirmed
                ? `${selected.name} confirmado. Você ainda pode trocar até a batalha começar.`
                : `${selected.name} selecionado. Falta confirmar.`}
        </p>
        {!confirmed && !battle.started ? (
          <button
            type="button"
            className="btn btn-primary text-lg"
            disabled={!selected}
            onClick={() => updateDemo((current) => confirmRepresentative(current, "t1"))}
          >
            Confirmar representante
          </button>
        ) : (
          <Link href="/palco" className="btn btn-primary text-lg">
            Ir para o palco das maletas <span aria-hidden="true">→</span>
          </Link>
        )}
      </ActionBar>
    </div>
  );
}
