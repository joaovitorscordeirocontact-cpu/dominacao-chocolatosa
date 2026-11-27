import { BODY_COLORS, NAME_MAX_LENGTH, SLOT_IDS, SLOTS } from "./catalog.ts";
import type { AccessoryId, AccessorySlot, Accessories, DemoState, MascotLook, Profile } from "./types.ts";

export function createDefaultState(): DemoState {
  return {
    settings: { showAtmosfera: true },
    profile: { name: "", color: "rosa", accessories: {} },
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

/** Valida o que veio do localStorage; qualquer parte inválida volta ao padrão. */
export function sanitizeState(raw: unknown): DemoState {
  const base = createDefaultState();
  if (!isObject(raw)) return base;
  const settings = isObject(raw.settings) ? raw.settings : {};
  const profile = isObject(raw.profile) ? raw.profile : {};
  return {
    settings: {
      showAtmosfera:
        typeof settings.showAtmosfera === "boolean" ? settings.showAtmosfera : base.settings.showAtmosfera,
    },
    profile: { name: cleanName(profile.name), ...sanitizeLook(profile, base.profile) },
  };
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
