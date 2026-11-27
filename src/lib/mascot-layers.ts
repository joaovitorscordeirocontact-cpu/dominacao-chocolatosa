/** Montagem do mascote em camadas, a partir das âncoras de accessory-layout.json. */
import layout from "../data/accessory-layout.json" with { type: "json" };
import { SLOT_IDS } from "./catalog.ts";
import type { AccessoryId, MascotLook } from "./types.ts";

export type Layer = {
  key: string;
  /** Nome do arquivo em /assets/personagem (sem extensão). */
  file: string;
  z: number;
  /** Posição e tamanho no sistema de coordenadas do CORPO. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Recorte (polígono CSS em % da própria peça) do cabelo sob um chapéu. */
  clipPath?: string;
};

type LayerSpec = { asset: string; z: number; cx: number; top: number; width: number; ratio: number; tint?: boolean };

const accessories = layout.accessories as Record<AccessoryId, LayerSpec[]>;
const hairUnderHat = layout.hairUnderHat as Record<string, number[][]>;

export const STAGE = layout.stage;
export const BODY_Z = layout.bodyZ;

export function accessoryLayers({ accessories: worn, hairColor }: MascotLook): Layer[] {
  const ids = SLOT_IDS.flatMap((slot) => worn[slot] ?? []);
  const hairCut = worn.chapeu ? hairUnderHat[worn.chapeu] : undefined;

  return ids
    .flatMap((id) =>
      accessories[id].map((spec): Layer => {
        const left = spec.cx - spec.width / 2;
        const height = spec.width * spec.ratio;
        const clipPath =
          spec.tint && hairCut
            ? `polygon(${hairCut
                .map(([x, y]) => `${percent(x - left, spec.width)} ${percent(y - spec.top, height)}`)
                .join(", ")})`
            : undefined;
        return {
          key: spec.asset,
          file: spec.tint ? `${spec.asset}-${hairColor}` : spec.asset,
          z: spec.z,
          left,
          top: spec.top,
          width: spec.width,
          height,
          clipPath,
        };
      }),
    )
    .sort((a, b) => a.z - b.z);
}

export function percent(value: number, total: number): string {
  return `${Math.round((value / total) * 10000) / 100}%`;
}
