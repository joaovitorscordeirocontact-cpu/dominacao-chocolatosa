"use client";

/**
 * Estado local da demonstração, persistido em localStorage.
 *
 * NÃO há servidor nem sincronização entre aparelhos. O evento "storage" apenas
 * mantém coerentes as abas/janelas do MESMO navegador (ex.: moderação + telão
 * no mesmo computador).
 */
import { useSyncExternalStore } from "react";
import { createDefaultState, sanitizeState } from "./demo-state";
import type { DemoState } from "./types";

const STORAGE_KEY = "dominacao-chocolatosa:v1";

const serverState = createDefaultState();
let cache: DemoState | null = null;
const listeners = new Set<() => void>();

function parse(text: string | null): DemoState {
  try {
    return sanitizeState(text ? JSON.parse(text) : null);
  } catch {
    return createDefaultState();
  }
}

function getSnapshot(): DemoState {
  if (!cache) {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Armazenamento bloqueado (ex.: modo privado): segue só em memória.
    }
    cache = parse(stored);
  }
  return cache;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  cache = parse(event.newValue);
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function updateDemo(change: (state: DemoState) => DemoState) {
  const current = getSnapshot();
  const next = change(current);
  if (next === current) return;
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sem persistência disponível; o estado em memória continua válido.
  }
  emit();
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverState);
}

const noopSubscribe = () => () => {};

/** `false` durante o HTML do servidor; evita piscar dados padrão antes dos salvos. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
