/** Formato devolvido por public.dc_snapshot. Não contém nenhum segredo. */
import type { BackgroundId, FactoryModelId, MascotLook } from "../types.ts";

export type RoomStatus = "lobby" | "factories" | "playing" | "ended";

export type RoundStage =
  | "representatives"
  | "battle"
  | "preparation"
  | "picking"
  | "interference"
  | "review"
  | "paid";

export type MemberKind = "moderator" | "player" | "screen";

export type CaseKind = "gain" | "loss" | "loss_third" | "zero";

export type ComboPower = "blue" | "yellow" | "green" | "red";
export type SpecialPower = "invert" | "joker" | "block" | "plus2" | "plus4";
export type Power = ComboPower | SpecialPower;

export type RoomInfo = {
  id: string;
  code: string;
  status: RoomStatus;
  stage: RoundStage | null;
  round: number;
  maxRounds: number;
  totalChocolates: number | null;
  initialPerTeam: number | null;
  bank: number | null;
  entriesOpen: boolean;
  revision: number;
};

export type Member = {
  id: string;
  kind: MemberKind;
  name: string;
  look: MascotLook;
  teamId: string | null;
  isCaptain: boolean;
  battles: number;
};

export type Team = {
  id: string;
  slot: number;
  name: string;
  model: FactoryModelId;
  background: BackgroundId;
  ready: boolean;
  balance: number;
};

export type RoundTeam = {
  teamId: string;
  startBalance: number;
  representativeId: string | null;
  battlePlace: number | null;
  playPosition: number | null;
  caseNumber: number | null;
  blocked: boolean;
  bonus: number;
};

export type CaseInfo = {
  number: number;
  state: "available" | "chosen" | "opened";
  openedRound: number | null;
  /** Só preenchidos depois da revelação pública. */
  kind: CaseKind | null;
  amount: number | null;
};

export type PowerUse = {
  teamId: string;
  category: "combo" | "special";
  power: Power;
  targetTeamId: string | null;
};

export type SettlementRow = {
  teamId: string;
  startBalance: number;
  caseNumber: number;
  caseKind: CaseKind;
  caseAmount: number;
  delta: number;
  effective: number;
  blocked: boolean;
  bonus: number;
  finalBalance: number;
};

export type Payment = SettlementRow & { round: number };

export type HistoryEntry = {
  id: number;
  revision: number;
  round: number;
  type: string;
  data: Record<string, unknown>;
  at: string;
};

export type Snapshot = {
  ok: true;
  room: RoomInfo;
  me: { memberId: string; kind: MemberKind; teamId: string | null; isCaptain: boolean };
  members: Member[];
  teams: Team[];
  roundTeams: RoundTeam[];
  cases: CaseInfo[];
  powers: PowerUse[];
  bonusCardsUsed: { plus2: number; plus4: number };
  spy: { teamId: string; status: "active" | "used" | "expired" }[];
  settlement: SettlementRow[] | null;
  payments: Payment[];
  history: HistoryEntry[];
};

export type SnapshotResult = Snapshot | { ok: false; error: string };

export type SpyResult = { number: number; kind: CaseKind; amount: number };
export type SpyRecord = SpyResult & { round: number };
