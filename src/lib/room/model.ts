/** Leituras derivadas do estado da sala e textos em português (funções puras). */
import type { CaseKind, HistoryEntry, Member, Power, RoundStage, RoundTeam, Snapshot, Team } from "./types.ts";

export const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0");

export const chocolates = (value: number) => `${value} ${Math.abs(value) === 1 ? "bombom" : "bombons"}`;

export type TeamView = Team & {
  label: string;
  members: Member[];
  captain: Member | undefined;
  round: RoundTeam | undefined;
};

export const factoryLabel = (team: Pick<Team, "name" | "slot">) => team.name || `Fábrica ${team.slot}`;

export const memberName = (member: Pick<Member, "name" | "kind"> | undefined) =>
  member?.name || (member?.kind === "moderator" ? "Moderador" : "—");

export function teamViews(snapshot: Snapshot): TeamView[] {
  return snapshot.teams.map((team) => {
    const members = snapshot.members.filter((member) => member.teamId === team.id);
    return {
      ...team,
      label: factoryLabel(team),
      members,
      captain: members.find((member) => member.isCaptain),
      round: snapshot.roundTeams.find((row) => row.teamId === team.id),
    };
  });
}

/** Na ordem de jogada quando ela já existe; antes disso, pela numeração. */
export function inPlayOrder(teams: TeamView[]): TeamView[] {
  return [...teams].sort(
    (a, b) => (a.round?.playPosition ?? 9) - (b.round?.playPosition ?? 9) || a.slot - b.slot,
  );
}

/** Fábrica da vez na escolha das maletas. */
export function teamOnTurn(snapshot: Snapshot): TeamView | undefined {
  if (snapshot.room.stage !== "picking") return undefined;
  return inPlayOrder(teamViews(snapshot)).find((team) => team.round && team.round.caseNumber === null);
}

/** Painel: maletas consumidas em rodadas anteriores saem dele. */
export function boardCases(snapshot: Snapshot) {
  return snapshot.cases.filter((item) => item.state !== "opened" || item.openedRound === snapshot.room.round);
}

export const availableCount = (snapshot: Snapshot) =>
  snapshot.cases.filter((item) => item.state === "available").length;

/** Classificação por saldo; empates dividem a mesma posição. */
export function standings<T extends Pick<Team, "balance" | "slot">>(teams: T[]) {
  const sorted = [...teams].sort((a, b) => b.balance - a.balance || a.slot - b.slot);
  return sorted.map((team) => ({
    team,
    position: sorted.findIndex((other) => other.balance === team.balance) + 1,
  }));
}

export const STAGE_LABELS: Record<RoundStage, string> = {
  representatives: "Representantes",
  battle: "Batalha pelas cartas",
  preparation: "Preparação",
  picking: "Escolha das maletas",
  interference: "Interferência",
  review: "Conferência",
  paid: "Pagamento feito",
};

export function stageLabel({ room }: Snapshot): string {
  if (room.status === "lobby") return "Sala de espera";
  if (room.status === "factories") return "Fábricas";
  if (room.status === "ended") return "Partida encerrada";
  return STAGE_LABELS[room.stage!];
}

export const POWER_LABELS: Record<Power, string> = {
  blue: "Azul · Espionagem industrial",
  yellow: "Amarelo · Informante",
  green: "Verde · Reciclagem",
  red: "Vermelho · Roubo de receita",
  invert: "Inverter",
  joker: "Coringa",
  block: "Bloqueio",
  plus2: "Bônus +2",
  plus4: "Bônus +4",
};

export const COMBO_HELP = {
  blue: "Ver em segredo, no celular da liderança, uma maleta disponível. Não reserva a maleta.",
  yellow: "Presencial: escolher uma carta virada da mão de um adversário, olhar e devolver.",
  green: "Presencial: entregar as duas verdes e comprar três cartas às cegas.",
  red: "Presencial: escolher uma carta virada da mão de um adversário e ficar com ela, sem olhar antes.",
} as const;

export const SPECIAL_HELP = {
  invert: "Todas as maletas avançam uma fábrica, na ordem de jogada.",
  joker: "Troca a maleta da própria fábrica com a de outra.",
  block: "Protege a própria fábrica de uma maleta negativa.",
  plus2: "Soma 2 bombons fixos à própria fábrica.",
  plus4: "Soma 4 bombons fixos à própria fábrica.",
} as const;

/** Valor curto para mostrar dentro da maleta. */
export function caseValue(kind: CaseKind, amount: number): string {
  if (kind === "gain") return `+${amount}`;
  if (kind === "loss") return `−${amount}`;
  if (kind === "loss_third") return "−⅓";
  return "0";
}

export function caseDescription(kind: CaseKind, amount: number): string {
  if (kind === "gain") return `Ganho de ${chocolates(amount)}`;
  if (kind === "loss") return `Perda de ${chocolates(amount)} (o saldo não fica negativo)`;
  if (kind === "loss_third") return "Perde um terço do saldo do início da rodada (arredondado para baixo)";
  return "Zero: nada muda";
}

/** Frase pública para o histórico e o destaque do telão. */
export function eventText(entry: HistoryEntry, snapshot: Snapshot): string {
  const data = entry.data as {
    teamId?: string;
    targetTeamId?: string;
    memberId?: string;
    power?: Power;
    number?: number;
    name?: string;
    kind?: string;
    ready?: boolean;
    open?: boolean;
    teams?: number;
    round?: number;
  };
  const team = (id?: string) => {
    const found = snapshot.teams.find((option) => option.id === id);
    return found ? factoryLabel(found) : "Fábrica";
  };
  const person = (id?: string) => memberName(snapshot.members.find((option) => option.id === id));
  const power = data.power ? POWER_LABELS[data.power] : "";
  const target = data.targetTeamId ? ` contra ${team(data.targetTeamId)}` : "";

  switch (entry.type) {
    case "joined":
      return data.kind === "screen" ? "Um telão foi conectado" : `${data.name} entrou na sala`;
    case "set_look":
      return `${person(data.memberId)} atualizou o mascote`;
    case "set_entries":
      return data.open ? "Entradas reabertas" : "Entradas fechadas";
    case "remove_member":
      return data.kind === "screen" ? "Um telão foi desconectado" : `${data.name} saiu da sala`;
    case "form_teams":
      return `${data.teams} equipes sorteadas`;
    case "reset_teams":
      return "Divisão das equipes desfeita";
    case "assign_member":
      return `${person(data.memberId)} entrou em ${team(data.teamId)}`;
    case "set_captain":
      return `${person(data.memberId)} agora lidera ${team(data.teamId)}`;
    case "set_factory":
      return data.ready ? `${team(data.teamId)} está pronta` : `${team(data.teamId)} está sendo personalizada`;
    case "set_economy":
      return "Bombons configurados";
    case "start_match":
      return "A partida começou!";
    case "select_representative":
      return `${team(data.teamId)} indicou um representante`;
    case "start_battle":
      return "Batalha pelas cartas!";
    case "record_battle":
      return "Resultado da batalha registrado";
    case "register_combo":
      return `${team(data.teamId)}: ${power}${target}`;
    case "undo_combo":
      return `Registro desfeito: ${team(data.teamId)}, ${power}`;
    case "spy_used":
      return `${team(data.teamId)} fez a espionagem em segredo`;
    case "close_preparation":
      return "Preparação encerrada. Escolham as maletas!";
    case "pick_case":
      return `${team(data.teamId)} escolheu a maleta ${data.number}`;
    case "undo_pick":
      return `Escolha da maleta ${data.number} desfeita`;
    case "reveal":
      return "Maletas abertas!";
    case "register_special":
      return data.power === "invert"
        ? `${team(data.teamId)} usou Inverter! As maletas avançaram`
        : `${team(data.teamId)} usou ${power}${data.targetTeamId ? ` com ${team(data.targetTeamId)}` : ""}!`;
    case "undo_special":
      return `Carta desfeita: ${team(data.teamId)}, ${power}`;
    case "open_review":
      return "Conferindo os resultados";
    case "back_to_interference":
      return "De volta à interferência";
    case "confirm_payment":
      return "Pagamento confirmado!";
    case "next_round":
      return `Rodada ${data.round}`;
    case "end_match":
      return "Partida encerrada!";
    default:
      return "Sala atualizada";
  }
}
