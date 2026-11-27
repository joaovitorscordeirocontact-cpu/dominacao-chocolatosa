import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import layout from "../src/data/accessory-layout.json" with { type: "json" };
import { HAIR_COLORS, SLOT_IDS, SLOTS } from "../src/lib/catalog.ts";
import { sanitizeState } from "../src/lib/demo-state.ts";
import { sanitizeLook, sanitizeProfile } from "../src/lib/look.ts";
import { accessoryLayers, BODY_Z } from "../src/lib/mascot-layers.ts";

/** Dimensões de um WebP com canal alfa (cabeçalho VP8X) ou sem perdas (VP8L). */
function webpSize(path: string) {
  const data = readFileSync(path);
  const kind = data.toString("ascii", 12, 16);
  if (kind === "VP8X") return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  if (kind === "VP8L") {
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
}

test("perfil antigo: topete loiro vira cabelo curto loiro sem perder o resto", () => {
  const migrated = sanitizeProfile({
    name: "Bia",
    color: "verde",
    accessories: { cabelo: "topete-loiro", chapeu: "bone", olhos: "monoculo", traje: "capa", enfeite: "laco" },
  });
  assert.deepEqual(migrated, {
    name: "Bia",
    color: "verde",
    hairColor: "loiro",
    accessories: { chapeu: "bone", cabelo: "cabelo-curto", olhos: "monoculo", traje: "capa", enfeite: "laco" },
  });
});

test("perfil antigo: cabelo ondulado continua longo e castanho", () => {
  const migrated = sanitizeLook({ color: "azul", accessories: { cabelo: "cabelo-longo", pelos: "barba" } });
  assert.equal(migrated.accessories.cabelo, "cabelo-longo");
  assert.equal(migrated.accessories.pelos, "barba");
  assert.equal(migrated.hairColor, "castanho");
});

test("escolha nova de cor de cabelo é preservada, inclusive ao reler o estado salvo", () => {
  const saved = sanitizeState({ profile: { name: "A", color: "rosa", hairColor: "branco", accessories: { cabelo: "cabelo-cacheado" } } });
  assert.equal(saved.profile.hairColor, "branco");
  assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(saved))).profile, saved.profile);
});

test("valores desconhecidos são descartados", () => {
  const look = sanitizeLook({ color: "neon", hairColor: "azul", accessories: { cabelo: "moicano", chapeu: "coroa" } });
  assert.deepEqual(look, { color: "rosa", hairColor: "castanho", accessories: { chapeu: "coroa" } });
});

test("camadas: capa atrás, cabelo traseiro, corpo, frente, rosto, chapéu e fecho", () => {
  const layers = accessoryLayers({
    color: "azul",
    hairColor: "vermelho",
    accessories: { traje: "capa", cabelo: "cabelo-longo", olhos: "oculos-redondos", chapeu: "coroa" },
  });
  const order = [...layers.map((layer) => ({ file: layer.file, z: layer.z })), { file: "corpo", z: BODY_Z }]
    .sort((a, b) => a.z - b.z)
    .map((layer) => layer.file);
  assert.deepEqual(order, [
    "capa-tras",
    "cabelo-longo-tras-vermelho",
    "corpo",
    "cabelo-longo-frente-vermelho",
    "oculos-redondos",
    "coroa",
    "capa-fecho",
  ]);
});

test("recorte sob o chapéu atinge só o cabelo, na frente e atrás", () => {
  const withHat = accessoryLayers({ color: "azul", hairColor: "preto", accessories: { cabelo: "cabelo-longo", chapeu: "cartola", traje: "capa" } });
  for (const layer of withHat) assert.equal(Boolean(layer.clipPath), layer.key.startsWith("cabelo"), layer.key);
  const noHat = accessoryLayers({ color: "azul", hairColor: "preto", accessories: { cabelo: "cabelo-longo", chapeu: "aureola" } });
  assert.ok(noHat.every((layer) => !layer.clipPath), "a auréola não esconde cabelo");
});

test("todo acessório tem arquivos existentes e proporção igual à da imagem", () => {
  for (const slot of SLOT_IDS) {
    for (const item of SLOTS[slot].items) {
      for (const hair of HAIR_COLORS) {
        const layers = accessoryLayers({ color: "rosa", hairColor: hair.id, accessories: { [slot]: item.id } });
        assert.ok(layers.length > 0, item.id);
        for (const layer of layers) {
          const path = `public/assets/personagem/${layer.file}.webp`;
          assert.ok(existsSync(path), path);
          const size = webpSize(path);
          // A capa é esticada na largura de propósito para aparecer nas laterais.
          if (layer.key === "capa-tras") continue;
          assert.ok(Math.abs(size.height / size.width - layer.height / layer.width) < 0.01, `proporção de ${path}`);
        }
      }
    }
  }
  assert.deepEqual(Object.keys(layout.hairUnderHat).sort(), ["bone", "cartola", "chapeu-chef", "coroa"]);
});
