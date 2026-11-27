"use client";

/** Etapas de uma rodada, na visão de quem modera. */
import { useState } from "react";
import { Avatar } from "@/components/mascot/Avatar";
import { CaseBoard } from "@/components/stage/CaseBoard";
import { CaseTable } from "@/components/stage/CaseTable";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { FitName } from "@/components/ui/FitName";
import { teamColor } from "@/lib/catalog";
import {
  COMBO_HELP,
  inPlayOrder,
  memberName,
  POWER_LABELS,
  SPECIAL_HELP,
  teamOnTurn,
  teamViews,
  type TeamView,
} from "@/lib/room/model";
import type { ComboPower, Snapshot, SpecialPower } from "@/lib/room/types";
import type { Commands } from "@/lib/room/useCommand";
import { SettlementList } from "./SettlementList";

type Props = { snapshot: Snapshot; commands: Commands };

const Heading = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div className="mb-3">
    <h2 className="text-xl font-black">{children}</h2>
    {hint && <p className="mt-1 text-sm text-cream/85">{hint}</p>}
  </div>
);

function TeamRow({ team, children }: { team: TeamView; children: React.ReactNode }) {
  return (
    <div
      className="min-w-0 rounded-2xl border-2 border-l-8 bg-chocolate/90 p-3"
      style={{ borderColor: teamColor(team.slot) }}
    >
      <FitName className="leading-tight font-black">{team.label}</FitName>
      {children}
    </div>
  );
}

function Representatives({ snapshot, commands }: Props) {
  const teams = teamViews(snapshot);
  const ready = teams.every((team) => team.round?.representativeId);
  return (
    <>
      <Heading hint="Cada capitão indica alguém no próprio celular e pode trocar até você iniciar.">
        Representantes
      </Heading>
      <ul className="grid gap-2 sm:grid-cols-2">
        {teams.map((team) => {
          const member = team.members.find((item) => item.id === team.round?.representativeId);
          return (
            <li key={team.id}>
              <TeamRow team={team}>
                {member ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Avatar look={member.look} className="size-12" />
                    <span className="min-w-0 flex-1">
                      <FitName className="font-extrabold">{memberName(member)}</FitName>
                      <span className="text-xs text-cream/80">
                        {member.battles} {member.battles === 1 ? "batalha" : "batalhas"} até agora
                      </span>
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-bold text-blush">Aguardando a liderança…</p>
                )}
              </TeamRow>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 grid gap-2">
        <ConfirmButton
          className="btn btn-primary text-lg"
          confirmLabel="Confirmar início da batalha"
          disabled={!ready || commands.pending !== null}
          onConfirm={() => void commands.run("start_battle")}
        >
          Iniciar batalha
        </ConfirmButton>
        {snapshot.room.round > 1 && (
          <ConfirmButton
            className="btn btn-ghost text-sm"
            confirmLabel="Confirmar: encerrar a partida"
            disabled={commands.pending !== null}
            onConfirm={() => void commands.run("end_match")}
          >
            Encerrar a partida sem jogar esta rodada
          </ConfirmButton>
        )}
      </div>
    </>
  );
}

function OrderPicker({
  label,
  teams,
  order,
  onChange,
  note,
}: {
  label: string;
  teams: TeamView[];
  order: string[];
  onChange: (order: string[]) => void;
  note: (index: number) => string;
}) {
  const move = (index: number, step: number) => {
    const next = [...order];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
  };
  return (
    <fieldset className="panel p-3">
      <legend className="sr-only">{label}</legend>
      <p className="mb-2 font-black" aria-hidden="true">
        {label}
      </p>
      <ol className="grid gap-2">
        {order.map((id, index) => {
          const team = teams.find((item) => item.id === id)!;
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-xl border-l-8 bg-espresso/60 p-2"
              style={{ borderColor: teamColor(team.slot) }}
            >
              <span className="gold-text w-8 shrink-0 text-xl">{index + 1}º</span>
              <span className="min-w-0 flex-1">
                <FitName className="leading-tight font-extrabold">{team.label}</FitName>
                <span className="text-xs text-cream/75">{note(index)}</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost size-11! min-h-0! shrink-0 p-0!"
                aria-label={`Subir ${team.label}`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-ghost size-11! min-h-0! shrink-0 p-0!"
                aria-label={`Descer ${team.label}`}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
}

function BattleResult({ snapshot, commands, submitLabel }: Props & { submitLabel: string }) {
  const teams = teamViews(snapshot);
  const saved = (key: "battlePlace" | "playPosition") =>
    [...teams].sort((a, b) => (a.round?.[key] ?? a.slot) - (b.round?.[key] ?? b.slot)).map((team) => team.id);
  const [ranking, setRanking] = useState(() => saved("battlePlace"));
  // Até alguém mexer na ordem de jogada, ela acompanha a classificação.
  const [custom, setCustom] = useState<string[] | null>(() =>
    saved("playPosition").join() === saved("battlePlace").join() ? null : saved("playPosition"),
  );
  const references = teams.length - 1;
  return (
    <div className="grid gap-3">
      <OrderPicker
        label="Classificação da batalha"
        teams={teams}
        order={ranking}
        onChange={setRanking}
        note={(index) => (index < references ? "Venceu referência: 2 cartas às cegas" : "Não recebe cartas")}
      />
      <OrderPicker
        label="Ordem de jogada"
        teams={teams}
        order={custom ?? ranking}
        onChange={setCustom}
        note={() => (custom ? "Ordem definida por você" : "Igual à classificação")}
      />
      <button
        type="button"
        className="btn btn-primary text-lg"
        disabled={commands.pending !== null}
        onClick={() => void commands.run("record_battle", { ranking, playOrder: custom ?? ranking })}
      >
        {submitLabel}
      </button>
    </div>
  );
}

function Battle(props: Props) {
  const teams = teamViews(props.snapshot);
  return (
    <>
      <Heading
        hint={`${teams.length - 1} ${teams.length === 2 ? "referência" : "referências"}; cada participante vence no máximo uma. Quem vence recebe duas cartas físicas às cegas; uma fábrica fica sem cartas. As cartas podem ser guardadas.`}
      >
        Batalha pelas cartas
      </Heading>
      <ul className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {teams.map((team) => {
          const member = team.members.find((item) => item.id === team.round?.representativeId);
          return (
            <li
              key={team.id}
              className="flex min-w-0 flex-col items-center rounded-2xl border-2 bg-chocolate p-2 text-center"
              style={{ borderColor: teamColor(team.slot) }}
            >
              {member && <Avatar look={member.look} className="size-16" />}
              <FitName className="mt-1 font-black">{memberName(member)}</FitName>
              <FitName className="text-xs text-blush">{team.label}</FitName>
            </li>
          );
        })}
      </ul>
      <BattleResult {...props} submitLabel="Registrar e abrir a preparação" />
    </>
  );
}

function ComboRow({ snapshot, commands, team, teams }: Props & { team: TeamView; teams: TeamView[] }) {
  const [power, setPower] = useState<ComboPower | null>(null);
  const [target, setTarget] = useState("");
  const used = snapshot.powers.find((use) => use.teamId === team.id && use.category === "combo");
  const spy = snapshot.spy.find((item) => item.teamId === team.id)?.status;
  const needsTarget = power === "yellow" || power === "red";
  const busy = commands.pending !== null;

  return (
    <TeamRow team={team}>
      {used ? (
        <div className="mt-2">
          <p className="font-extrabold">
            {POWER_LABELS[used.power]}
            {used.targetTeamId && ` → ${teams.find((t) => t.id === used.targetTeamId)?.label}`}
          </p>
          {used.power === "blue" && (
            <p className="text-sm font-bold text-gold">
              {spy === "used" ? "✓ A liderança já espiou." : "Aguardando a liderança espiar no celular."}
            </p>
          )}
          <p className="mt-1 text-xs text-cream/75">A liderança confere e recolhe as duas cartas.</p>
          <button
            type="button"
            className="btn btn-ghost mt-2 min-h-11! text-xs"
            disabled={busy || spy === "used"}
            onClick={() => void commands.run("undo_combo", { teamId: team.id })}
          >
            {spy === "used" ? "Maleta já vista: não dá para desfazer" : "Desfazer registro"}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <div className="grid grid-cols-2 gap-2">
            {(["blue", "yellow", "green", "red"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={power === option}
                onClick={() => setPower(power === option ? null : option)}
                className={`min-h-12 cursor-pointer rounded-xl border-2 px-2 text-xs font-extrabold ${
                  power === option ? "border-white bg-cream text-espresso" : "border-cream/25 bg-espresso/70"
                }`}
              >
                {POWER_LABELS[option]}
              </button>
            ))}
          </div>
          {power && <p className="mt-2 text-xs">{COMBO_HELP[power]}</p>}
          {needsTarget && (
            <label className="mt-2 block text-sm font-bold">
              Adversário
              <select className="field mt-1" value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">Escolha…</option>
                {teams
                  .filter((other) => other.id !== team.id)
                  .map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {power && (
            <button
              type="button"
              className="btn btn-gold mt-2 w-full text-sm"
              disabled={busy || (needsTarget && !target)}
              onClick={() =>
                void commands.run("register_combo", {
                  teamId: team.id,
                  power,
                  targetTeamId: needsTarget ? target : null,
                })
              }
            >
              {power === "blue" ? "Autorizar a espionagem" : "Registrar uso"}
            </button>
          )}
        </div>
      )}
    </TeamRow>
  );
}

function Preparation(props: Props) {
  const { snapshot, commands } = props;
  const teams = inPlayOrder(teamViews(snapshot));
  const pendingSpy = snapshot.spy.some((item) => item.status === "active");
  return (
    <>
      <Heading hint="Uma combinação por fábrica nesta rodada. Cartas especiais coloridas não contam. Nada de secreto é registrado aqui.">
        Preparação
      </Heading>
      <ul className="grid gap-2 sm:grid-cols-2">
        {teams.map((team) => (
          <li key={`${snapshot.room.round}-${team.id}`}>
            <ComboRow {...props} team={team} teams={teams} />
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-blush">
          Corrigir classificação ou ordem de jogada
        </summary>
        <div className="mt-2">
          <BattleResult {...props} submitLabel="Salvar correção" />
        </div>
      </details>
      <div className="mt-4">
        {pendingSpy ? (
          <ConfirmButton
            className="btn btn-primary w-full text-lg"
            confirmLabel="Encerrar mesmo assim: a espionagem pendente será perdida"
            disabled={commands.pending !== null}
            onConfirm={() => void commands.run("close_preparation", { force: true })}
          >
            Encerrar preparação (há espionagem pendente)
          </ConfirmButton>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full text-lg"
            disabled={commands.pending !== null}
            onClick={() => void commands.run("close_preparation")}
          >
            Encerrar preparação e liberar as escolhas
          </button>
        )}
      </div>
    </>
  );
}

function Picking({ snapshot, commands }: Props) {
  const teams = inPlayOrder(teamViews(snapshot));
  const turn = teamOnTurn(snapshot);
  const picked = teams.filter((team) => team.round?.caseNumber).length;
  return (
    <>
      <Heading hint="Cada capitão escolhe no próprio celular, na ordem de jogada. As maletas continuam fechadas.">
        {turn ? `Vez de ${turn.label}` : "Todas as fábricas escolheram"}
      </Heading>
      <CaseTable snapshot={snapshot} />
      <div className="mt-4 grid gap-2">
        <ConfirmButton
          className="btn btn-primary text-lg"
          confirmLabel="Confirmar: abrir para todos"
          disabled={Boolean(turn) || commands.pending !== null}
          onConfirm={() => void commands.run("reveal")}
        >
          Revelar as maletas
        </ConfirmButton>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          disabled={picked === 0 || commands.pending !== null}
          onClick={() => void commands.run("undo_pick")}
        >
          Desfazer a última escolha
        </button>
      </div>
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-blush">Ver o painel</summary>
        <CaseBoard snapshot={snapshot} teams={teams} />
      </details>
    </>
  );
}

function Interference({ snapshot, commands }: Props) {
  const teams = inPlayOrder(teamViews(snapshot));
  const specials = snapshot.powers.filter((use) => use.category === "special");
  const [teamId, setTeamId] = useState("");
  const [power, setPower] = useState<SpecialPower | "">("");
  const [target, setTarget] = useState("");
  const used = new Set(specials.map((use) => use.teamId));
  const team = used.has(teamId) ? "" : teamId;
  const { plus2, plus4 } = snapshot.bonusCardsUsed;
  const exhausted = (option: SpecialPower) => (option === "plus2" && plus2 >= 8) || (option === "plus4" && plus4 >= 4);
  const ready = team && power && !exhausted(power) && (power !== "joker" || (target && target !== team));
  const label = (id: string | null) => teams.find((item) => item.id === id)?.label ?? "";

  return (
    <>
      <Heading hint="Uma carta especial por fábrica nesta rodada. Os resultados ainda são provisórios.">
        Interferência
      </Heading>
      <CaseTable snapshot={snapshot} />

      <div className="panel mt-4 p-4">
        <h3 className="font-black">Registrar carta especial</h3>
        <p className="text-xs text-cream/80">
          Na partida: +2 usadas {plus2} de 8 · +4 usadas {plus4} de 4. As cartas de bônus saem do jogo.
        </p>
        <label className="mt-2 block text-sm font-bold">
          Quem usou
          <select className="field mt-1" value={team} onChange={(event) => setTeamId(event.target.value)}>
            <option value="">Escolha a fábrica…</option>
            {teams.map((option) => (
              <option key={option.id} value={option.id} disabled={used.has(option.id)}>
                {option.label}
                {used.has(option.id) ? " (já usou)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Carta especial">
          {(["invert", "joker", "block", "plus2", "plus4"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={power === option}
              disabled={exhausted(option)}
              onClick={() => setPower(option)}
              className={`min-h-12 cursor-pointer rounded-xl border-2 px-2 text-sm font-extrabold disabled:opacity-40 ${
                power === option ? "border-white bg-cream text-espresso" : "border-cream/25 bg-espresso/70"
              }`}
            >
              {POWER_LABELS[option]}
            </button>
          ))}
        </div>
        {power && <p className="mt-2 text-xs">{SPECIAL_HELP[power]}</p>}
        {power === "joker" && (
          <label className="mt-2 block text-sm font-bold">
            Trocar com
            <select className="field mt-1" value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">Escolha…</option>
              {teams
                .filter((option) => option.id !== team)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="btn btn-gold mt-3 w-full"
          disabled={!ready || commands.pending !== null}
          onClick={async () => {
            const ok = await commands.run("register_special", {
              teamId: team,
              power,
              targetTeamId: power === "joker" ? target : null,
            });
            if (ok) {
              setTeamId("");
              setPower("");
              setTarget("");
            }
          }}
        >
          Aplicar carta
        </button>
        {specials.length > 0 && (
          <>
            <ol className="mt-3 grid gap-1 text-sm">
              {specials.map((use, index) => (
                <li key={use.teamId} className="rounded-lg bg-espresso/60 px-2 py-1">
                  {index + 1}. {label(use.teamId)}: <strong>{POWER_LABELS[use.power]}</strong>
                  {use.targetTeamId && ` com ${label(use.targetTeamId)}`}
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full text-sm"
              disabled={commands.pending !== null}
              onClick={() => void commands.run("undo_special")}
            >
              Desfazer a última carta
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        className="btn btn-primary mt-4 w-full text-lg"
        disabled={commands.pending !== null}
        onClick={() => void commands.run("open_review")}
      >
        Ir para a conferência
      </button>
    </>
  );
}

function Review({ snapshot, commands }: Props) {
  return (
    <>
      <Heading hint="Confira com as equipes antes de pagar. Depois de pago, não há como desfazer.">Conferência</Heading>
      <SettlementList rows={snapshot.settlement ?? []} teams={inPlayOrder(teamViews(snapshot))} paid={false} />
      <div className="mt-4 grid gap-2">
        <ConfirmButton
          className="btn btn-primary text-lg"
          confirmLabel="Confirmar pagamento"
          disabled={commands.pending !== null}
          onConfirm={() => void commands.run("confirm_payment")}
        >
          Pagar os bombons
        </ConfirmButton>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          disabled={commands.pending !== null}
          onClick={() => void commands.run("back_to_interference")}
        >
          Voltar para a interferência
        </button>
      </div>
    </>
  );
}

function Paid({ snapshot, commands }: Props) {
  const { round, maxRounds } = snapshot.room;
  return (
    <>
      <Heading hint="Entreguem ou recolham os chocolates conforme a lista.">Pagamento da rodada {round} concluído</Heading>
      <SettlementList
        rows={snapshot.payments.filter((payment) => payment.round === round)}
        teams={inPlayOrder(teamViews(snapshot))}
        paid
      />
      <div className="mt-4 grid gap-2">
        {round < maxRounds ? (
          <button
            type="button"
            className="btn btn-primary text-lg"
            disabled={commands.pending !== null}
            onClick={() => void commands.run("next_round")}
          >
            Começar a rodada {round + 1}
          </button>
        ) : (
          <p className="text-center font-black text-gold">Esta foi a última rodada.</p>
        )}
        <ConfirmButton
          className={round < maxRounds ? "btn btn-ghost" : "btn btn-primary text-lg"}
          confirmLabel="Confirmar: encerrar a partida"
          disabled={commands.pending !== null}
          onConfirm={() => void commands.run("end_match")}
        >
          Encerrar a partida
        </ConfirmButton>
      </div>
    </>
  );
}

export function RoundStage(props: Props) {
  const { stage, round } = props.snapshot.room;
  const views = {
    representatives: Representatives,
    battle: Battle,
    preparation: Preparation,
    picking: Picking,
    interference: Interference,
    review: Review,
    paid: Paid,
  } as const;
  const View = views[stage!];
  return <View key={round} {...props} />;
}
