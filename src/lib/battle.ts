/** Regras (puras) da escolha de representantes para a batalha pelas cartas. */
import { TEAM_IDS } from "./catalog.ts";
import { buildTeams } from "./mock-data.ts";
import type { Battle, DemoState, TeamId } from "./types.ts";

/** Na demonstração, as três equipes fictícias já chegam com representante confirmado. */
export function createInitialBattle(): Battle {
  return {
    started: false,
    representatives: { t1: null, t2: "t2-2", t3: "t3-4", t4: "t4-3" },
    confirmed: { t1: false, t2: true, t3: true, t4: true },
  };
}

export function belongsToTeam(state: DemoState, teamId: TeamId, participantId: string): boolean {
  const team = buildTeams(state).find((option) => option.id === teamId);
  return Boolean(team?.participants.some((participant) => participant.id === participantId));
}

/** Selecionar NÃO conta participação. Trocar o escolhido desfaz a confirmação. */
export function selectRepresentative(state: DemoState, teamId: TeamId, participantId: string): DemoState {
  const { battle } = state;
  if (battle.started || battle.representatives[teamId] === participantId) return state;
  if (!belongsToTeam(state, teamId, participantId)) return state;
  return {
    ...state,
    battle: {
      ...battle,
      representatives: { ...battle.representatives, [teamId]: participantId },
      confirmed: { ...battle.confirmed, [teamId]: false },
    },
  };
}

export function confirmRepresentative(state: DemoState, teamId: TeamId): DemoState {
  const { battle } = state;
  if (battle.started || !battle.representatives[teamId] || battle.confirmed[teamId]) return state;
  return { ...state, battle: { ...battle, confirmed: { ...battle.confirmed, [teamId]: true } } };
}

export function canStartBattle({ battle }: DemoState): boolean {
  return !battle.started && TEAM_IDS.every((id) => battle.representatives[id] && battle.confirmed[id]);
}

/** Ação do moderador: o ÚNICO momento em que o contador de participações aumenta. */
export function startBattle(state: DemoState): DemoState {
  if (!canStartBattle(state)) return state;
  const participation = { ...state.participation };
  for (const teamId of TEAM_IDS) {
    const id = state.battle.representatives[teamId]!;
    participation[id] = (participation[id] ?? 0) + 1;
  }
  return { ...state, participation, battle: { ...state.battle, started: true } };
}

/** Libera uma nova escolha; as contagens permanecem. */
export function endBattle(state: DemoState): DemoState {
  if (!state.battle.started) return state;
  return { ...state, battle: createInitialBattle() };
}
