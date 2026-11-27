/**
 * Regras (puras) da demonstração visual das maletas.
 * Os valores são FICTÍCIOS: não representam o baralho nem a economia do jogo.
 */
import { TEAM_IDS } from "./catalog.ts";
import type { BonusValue, DemoState, Stage, TeamId } from "./types.ts";

export const CASE_COUNT = 60;
export const BONUS_VALUES: BonusValue[] = [2, 4];

const FAKE_RESULTS = [-3, 1, 2, 3, 5, 6, 8, 10, 12];

/** Valor fictício e fixo por número, para a demonstração ser repetível. */
export function caseResult(caseNumber: number): number {
  return FAKE_RESULTS[(caseNumber * 7 + 4) % FAKE_RESULTS.length];
}

export const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0");

const emptyPicks = (): Stage["picks"] => ({ t1: null, t2: null, t3: null, t4: null });

export function createInitialStage(): Stage {
  return {
    view: "escolha",
    picks: emptyPicks(),
    revealed: false,
    bonuses: { t1: 0, t2: 0, t3: 0, t4: 0 },
    event: null,
  };
}

export function allPicked({ picks }: Stage): boolean {
  return TEAM_IDS.every((id) => picks[id] !== null);
}

export function ownerOf(stage: Stage, caseNumber: number): TeamId | undefined {
  return TEAM_IDS.find((id) => stage.picks[id] === caseNumber);
}

function withStage(state: DemoState, change: Partial<Stage>, message: string, teams: TeamId[] = []): DemoState {
  const seq = (state.stage.event?.seq ?? 0) + 1;
  return { ...state, stage: { ...state.stage, ...change, event: { seq, message, teams } } };
}

/** Escolhe (ou desmarca) uma maleta. Maleta de outra fábrica fica indisponível. */
export function pickCase(state: DemoState, teamId: TeamId, caseNumber: number): DemoState {
  const { stage } = state;
  if (stage.view !== "escolha" || !Number.isInteger(caseNumber) || caseNumber < 1 || caseNumber > CASE_COUNT) {
    return state;
  }
  const owner = ownerOf(stage, caseNumber);
  if (owner && owner !== teamId) return state;
  const picks = { ...stage.picks, [teamId]: owner ? null : caseNumber };
  return withStage(state, { picks }, owner ? `Maleta ${caseNumber} liberada` : `Maleta ${caseNumber} escolhida`, [teamId]);
}

export function autoPick(state: DemoState, random: () => number = Math.random): DemoState {
  const { stage } = state;
  if (stage.view !== "escolha" || allPicked(stage)) return state;
  const picks = { ...stage.picks };
  const taken = new Set(Object.values(picks));
  const free = Array.from({ length: CASE_COUNT }, (_, index) => index + 1).filter((n) => !taken.has(n));
  for (const id of TEAM_IDS) {
    if (picks[id] === null) picks[id] = free.splice(Math.floor(random() * free.length), 1)[0];
  }
  return withStage(state, { picks }, "Maletas sorteadas para a demonstração");
}

export function showDuel(state: DemoState): DemoState {
  if (state.stage.view === "confronto" || !allPicked(state.stage)) return state;
  return withStage(state, { view: "confronto" }, "Quatro maletas na mesa!");
}

/** Só é possível voltar ao painel antes da revelação. */
export function backToBoard(state: DemoState): DemoState {
  if (state.stage.view !== "confronto" || state.stage.revealed) return state;
  return withStage(state, { view: "escolha" }, "De volta ao painel");
}

export function openCases(state: DemoState): DemoState {
  if (state.stage.view !== "confronto" || state.stage.revealed) return state;
  return withStage(state, { revealed: true }, "Maletas abertas!");
}

/** Inversão: todas as maletas avançam uma posição entre as fábricas. */
export function rotateCases(state: DemoState): DemoState {
  const { stage } = state;
  if (stage.view !== "confronto") return state;
  const picks = emptyPicks();
  TEAM_IDS.forEach((id, index) => {
    picks[TEAM_IDS[(index + 1) % TEAM_IDS.length]] = stage.picks[id];
  });
  return withStage(state, { picks }, "Inversão! Cada maleta avançou uma fábrica");
}

/** Coringa: troca as maletas de duas fábricas. */
export function swapCases(state: DemoState, first: TeamId, second: TeamId): DemoState {
  const { stage } = state;
  if (stage.view !== "confronto" || first === second) return state;
  const picks = { ...stage.picks, [first]: stage.picks[second], [second]: stage.picks[first] };
  return withStage(state, { picks }, "Coringa! Duas maletas trocaram de lugar", [first, second]);
}

export function addBonus(state: DemoState, teamId: TeamId, value: BonusValue): DemoState {
  const bonuses = { ...state.stage.bonuses, [teamId]: state.stage.bonuses[teamId] + value };
  return withStage(state, { bonuses }, `Bônus +${value}!`, [teamId]);
}

export function resetStage(state: DemoState): DemoState {
  return withStage(state, { ...createInitialStage() }, "Palco reiniciado");
}

export function sanitizeStage(raw: unknown): Stage {
  const stage = createInitialStage();
  if (typeof raw !== "object" || raw === null) return stage;
  const data = raw as Partial<Stage>;
  const used = new Set<number>();
  for (const id of TEAM_IDS) {
    const pick = data.picks?.[id];
    if (typeof pick === "number" && Number.isInteger(pick) && pick >= 1 && pick <= CASE_COUNT && !used.has(pick)) {
      stage.picks[id] = pick;
      used.add(pick);
    }
    const bonus = data.bonuses?.[id];
    if (typeof bonus === "number" && Number.isInteger(bonus) && bonus >= 0) stage.bonuses[id] = bonus;
  }
  if (data.view === "confronto" && allPicked(stage)) {
    stage.view = "confronto";
    stage.revealed = data.revealed === true;
  }
  const event = data.event;
  if (event && typeof event.seq === "number" && typeof event.message === "string" && Array.isArray(event.teams)) {
    stage.event = { seq: event.seq, message: event.message, teams: event.teams.filter((id) => TEAM_IDS.includes(id)) };
  }
  return stage;
}
