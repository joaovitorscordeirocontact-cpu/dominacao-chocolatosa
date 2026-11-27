import type { DemoState } from "./types";

export function createDefaultState(): DemoState {
  return {
    settings: { showAtmosfera: true },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Valida o que veio do localStorage; qualquer parte inválida volta ao padrão. */
export function sanitizeState(raw: unknown): DemoState {
  const base = createDefaultState();
  if (!isObject(raw)) return base;
  const settings = isObject(raw.settings) ? raw.settings : {};
  return {
    settings: {
      showAtmosfera:
        typeof settings.showAtmosfera === "boolean" ? settings.showAtmosfera : base.settings.showAtmosfera,
    },
  };
}
