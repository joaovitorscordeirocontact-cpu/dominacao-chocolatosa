/** Aparência do mascote: valores padrão, validação e migração de perfis antigos. */
import { BODY_COLORS, HAIR_COLORS, NAME_MAX_LENGTH, SLOT_IDS, SLOTS } from "./catalog.ts";
import type { Accessories, HairColor, MascotLook, Profile } from "./types.ts";

export const DEFAULT_LOOK: MascotLook = { color: "rosa", hairColor: "castanho", accessories: {} };

/**
 * Peças que deixaram de existir. O "topete loiro" tinha a cor embutida na arte;
 * vira o cabelo curto de lado, já em loiro.
 */
const LEGACY_HAIR: Record<string, { id: string; hairColor: HairColor }> = {
  "topete-loiro": { id: "cabelo-curto", hairColor: "loiro" },
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cleanName(value: unknown, maxLength = NAME_MAX_LENGTH): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

/** Aceita qualquer entrada e devolve uma aparência válida, sem perder o que for reconhecido. */
export function sanitizeLook(input: unknown, fallback: MascotLook = DEFAULT_LOOK): MascotLook {
  const raw = isObject(input) ? input : {};
  const stored: Record<string, unknown> = isObject(raw.accessories) ? { ...raw.accessories } : {};
  const legacy = typeof stored.cabelo === "string" ? LEGACY_HAIR[stored.cabelo] : undefined;
  if (legacy) stored.cabelo = legacy.id;

  const color = BODY_COLORS.find((option) => option.id === raw.color)?.id ?? fallback.color;
  const hairColor =
    HAIR_COLORS.find((option) => option.id === raw.hairColor)?.id ?? legacy?.hairColor ?? fallback.hairColor;

  const accessories: Accessories = {};
  for (const slot of SLOT_IDS) {
    const item = SLOTS[slot].items.find((option) => option.id === stored[slot]);
    if (item) accessories[slot] = item.id;
  }
  return { color, hairColor, accessories };
}

export function sanitizeProfile(input: unknown): Profile {
  return { name: cleanName(isObject(input) ? input.name : ""), ...sanitizeLook(input) };
}

/** Perfil salvo; na falta dele, o da primeira versão (`estado.profile`). */
export function loadProfile(saved: unknown, legacyState: unknown): Profile {
  if (isObject(saved)) return sanitizeProfile(saved);
  return sanitizeProfile(isObject(legacyState) ? legacyState.profile : null);
}
