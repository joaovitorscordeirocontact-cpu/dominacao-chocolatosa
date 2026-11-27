"use client";

/**
 * Perfil (nome e mascote) guardado neste aparelho, só para preencher a entrada.
 * O estado das partidas fica no Supabase, nunca aqui.
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_LOOK, loadProfile, sanitizeProfile } from "./look";
import type { Profile } from "./types";

const KEY = "dominacao-chocolatosa:perfil";
/** Chave da primeira versão (demonstração local), lida apenas para migrar o perfil. */
const LEGACY_KEY = "dominacao-chocolatosa:v1";

const SERVER_PROFILE: Profile = { name: "", ...DEFAULT_LOOK };
let cache: Profile | null = null;
const listeners = new Set<() => void>();

function read(key: string): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function getSnapshot(): Profile {
  cache ??= loadProfile(read(KEY), read(LEGACY_KEY));
  return cache;
}

export function saveProfile(profile: Profile) {
  cache = sanitizeProfile(profile);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Armazenamento bloqueado: o perfil continua valendo até fechar a página.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useProfile = () => useSyncExternalStore(subscribe, getSnapshot, () => SERVER_PROFILE);

const never = () => () => {};
/** `false` no HTML estático; evita piscar dados padrão antes dos salvos. */
export const useHydrated = () => useSyncExternalStore(never, () => true, () => false);
