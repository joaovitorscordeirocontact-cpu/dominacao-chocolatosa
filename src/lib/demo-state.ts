import { belongsToTeam, createInitialBattle } from "./battle.ts";
import {
  BACKGROUNDS,
  BODY_COLORS,
  FACTORY_MODELS,
  FACTORY_NAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
  SLOT_IDS,
  SLOTS,
  TEAM_IDS,
} from "./catalog.ts";
import { INITIAL_PARTICIPATION } from "./mock-data.ts";
import { createInitialStage, sanitizeStage } from "./stage.ts";
import type {
  AccessoryId,
  AccessorySlot,
  Accessories,
  Battle,
  DemoState,
  FactoryIdentity,
  MascotLook,
  Profile,
} from "./types.ts";

export function createDefaultState(): DemoState {
  return {
    profile: { name: "", color: "rosa", accessories: {} },
    factory: { name: "", model: "engrenagem", background: "palco-rosa" },
    battle: createInitialBattle(),
    participation: { ...INITIAL_PARTICIPATION },
    stage: createInitialStage(),
  };
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cleanName(value: unknown, maxLength = NAME_MAX_LENGTH): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function sanitizeLook(raw: Record<string, unknown>, fallback: MascotLook): MascotLook {
  const color = BODY_COLORS.find((option) => option.id === raw.color)?.id ?? fallback.color;
  const stored = isObject(raw.accessories) ? raw.accessories : {};
  const accessories: Accessories = {};
  for (const slot of SLOT_IDS) {
    const item = SLOTS[slot].items.find((option) => option.id === stored[slot]);
    if (item) accessories[slot] = item.id;
  }
  return { color, accessories };
}

function sanitizeFactory(raw: unknown, fallback: FactoryIdentity): FactoryIdentity {
  const data = isObject(raw) ? raw : {};
  return {
    name: cleanName(data.name, FACTORY_NAME_MAX_LENGTH),
    model: FACTORY_MODELS.find((option) => option.id === data.model)?.id ?? fallback.model,
    background: BACKGROUNDS.find((option) => option.id === data.background)?.id ?? fallback.background,
  };
}

function sanitizeBattle(raw: unknown, state: DemoState): Battle {
  if (!isObject(raw) || !isObject(raw.representatives) || !isObject(raw.confirmed)) return createInitialBattle();
  const battle = createInitialBattle();
  for (const teamId of TEAM_IDS) {
    const id = raw.representatives[teamId];
    battle.representatives[teamId] = typeof id === "string" && belongsToTeam(state, teamId, id) ? id : null;
    battle.confirmed[teamId] = battle.representatives[teamId] !== null && raw.confirmed[teamId] === true;
  }
  battle.started = raw.started === true && TEAM_IDS.every((teamId) => battle.confirmed[teamId]);
  return battle;
}

function sanitizeCounts(raw: unknown, fallback: Record<string, number>): Record<string, number> {
  if (!isObject(raw)) return fallback;
  return Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, number] => Number.isInteger(entry[1]) && (entry[1] as number) >= 0,
    ),
  );
}

/** Valida o que veio do localStorage; qualquer parte inválida volta ao padrão. */
export function sanitizeState(raw: unknown): DemoState {
  const base = createDefaultState();
  if (!isObject(raw)) return base;
  const profile = isObject(raw.profile) ? raw.profile : {};
  const state: DemoState = {
    ...base,
    profile: { name: cleanName(profile.name), ...sanitizeLook(profile, base.profile) },
    factory: sanitizeFactory(raw.factory, base.factory),
    participation: sanitizeCounts(raw.participation, base.participation),
    stage: sanitizeStage(raw.stage),
  };
  return { ...state, battle: sanitizeBattle(raw.battle, state) };
}

export function setFactory(state: DemoState, factory: FactoryIdentity): DemoState {
  return { ...state, factory: sanitizeFactory(factory, state.factory) };
}

export function setProfile(state: DemoState, change: Partial<Profile>): DemoState {
  const profile = { ...state.profile, ...change };
  profile.name = cleanName(profile.name);
  return { ...state, profile };
}

/** Equipa (ou retira, com `undefined`) o acessório de um espaço. */
export function setAccessory(state: DemoState, slot: AccessorySlot, id: AccessoryId | undefined): DemoState {
  const accessories: Accessories = { ...state.profile.accessories };
  if (id && SLOTS[slot].items.some((item) => item.id === id)) accessories[slot] = id;
  else delete accessories[slot];
  return setProfile(state, { accessories });
}
