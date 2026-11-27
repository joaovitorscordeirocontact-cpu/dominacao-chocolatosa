import type {
  AccessoryId,
  AccessorySlot,
  BackgroundId,
  BodyColor,
  FactoryModelId,
  TeamId,
} from "./types.ts";

export const BODY_COLORS: { id: BodyColor; label: string; swatch: string }[] = [
  { id: "azul", label: "Azul", swatch: "#4a8fe8" },
  { id: "verde", label: "Verde", swatch: "#4cbc6c" },
  { id: "rosa", label: "Rosa", swatch: "#f47aaa" },
  { id: "chocolate", label: "Chocolate", swatch: "#683824" },
  { id: "branco", label: "Branco", swatch: "#eee3dd" },
  { id: "marrom", label: "Marrom", swatch: "#b2703e" },
];

export const SLOTS: Record<AccessorySlot, { label: string; items: { id: AccessoryId; label: string }[] }> = {
  chapeu: {
    label: "No topo",
    items: [
      { id: "coroa", label: "Coroa" },
      { id: "chapeu-chef", label: "Chapéu de chef" },
      { id: "bone", label: "Boné" },
      { id: "cartola", label: "Cartola" },
      { id: "aureola", label: "Auréola" },
    ],
  },
  cabelo: {
    label: "Cabelo",
    items: [
      { id: "cabelo-longo", label: "Cabelo ondulado" },
      { id: "topete-loiro", label: "Topete loiro" },
    ],
  },
  olhos: {
    label: "Nos olhos",
    items: [
      { id: "oculos-redondos", label: "Óculos redondos" },
      { id: "oculos-escuros", label: "Óculos escuros" },
      { id: "monoculo", label: "Monóculo" },
    ],
  },
  pelos: {
    label: "Bigode e barba",
    items: [
      { id: "bigode", label: "Bigode" },
      { id: "barba", label: "Barba" },
    ],
  },
  traje: {
    label: "Traje",
    items: [
      { id: "gravata", label: "Gravata-borboleta" },
      { id: "capa", label: "Capa" },
    ],
  },
  enfeite: {
    label: "Enfeite",
    items: [{ id: "laco", label: "Laço" }],
  },
};

export const ACCESSORY_GROUPS: { id: string; label: string; slots: AccessorySlot[] }[] = [
  { id: "cabeca", label: "Cabeça", slots: ["chapeu", "cabelo"] },
  { id: "rosto", label: "Rosto", slots: ["olhos", "pelos"] },
  { id: "outros", label: "Outros", slots: ["traje", "enfeite"] },
];

export const SLOT_IDS = Object.keys(SLOTS) as AccessorySlot[];

export const NAME_MAX_LENGTH = 18;

export const FACTORY_NAME_MAX_LENGTH = 24;

export const FACTORY_MODELS: { id: FactoryModelId; label: string }[] = [
  { id: "engrenagem", label: "Engrenagem" },
  { id: "castelo", label: "Castelo" },
  { id: "palacio-dourado", label: "Palácio dourado" },
  { id: "rosquinha", label: "Rosquinha" },
  { id: "chale", label: "Chalé" },
  { id: "cupula", label: "Cúpula" },
  { id: "torre-torta", label: "Torre torta" },
  { id: "realeza", label: "Realeza" },
  { id: "cogumelo", label: "Cogumelo" },
  { id: "relogio", label: "Relógio" },
];

/** O visual de cada fundo está em globals.css (classe `fundo-<id>`). */
export const BACKGROUNDS: { id: BackgroundId; label: string }[] = [
  { id: "noite-cacau", label: "Noite de cacau" },
  { id: "palco-rosa", label: "Palco rosa" },
  { id: "raios-dourados", label: "Raios dourados" },
  { id: "rio-de-calda", label: "Rio de calda" },
  { id: "festa-uva", label: "Festa de uva" },
];

export const TEAM_IDS: TeamId[] = ["t1", "t2", "t3", "t4"];

/** Cor de identificação de cada equipe (sempre acompanhada do número e do nome). */
export const TEAM_COLORS: Record<TeamId, string> = {
  t1: "#ff4b9f",
  t2: "#5aa9ff",
  t3: "#5fd584",
  t4: "#ffc94d",
};
