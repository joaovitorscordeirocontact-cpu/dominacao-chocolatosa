export type BodyColor = "azul" | "verde" | "rosa" | "chocolate" | "branco" | "marrom";

/** Cor do cabelo, independente da cor do corpo. */
export type HairColor = "preto" | "vermelho" | "branco" | "loiro" | "castanho";

/** Cada espaço aceita um acessório por vez; espaços diferentes se combinam. */
export type AccessorySlot = "chapeu" | "cabelo" | "olhos" | "pelos" | "traje" | "enfeite";

export type AccessoryId =
  | "coroa"
  | "chapeu-chef"
  | "bone"
  | "cartola"
  | "aureola"
  | "cabelo-curto"
  | "cabelo-cacheado"
  | "cabelo-longo"
  | "oculos-redondos"
  | "oculos-escuros"
  | "monoculo"
  | "bigode"
  | "barba"
  | "gravata"
  | "capa"
  | "laco";

export type Accessories = Partial<Record<AccessorySlot, AccessoryId>>;

export type MascotLook = {
  color: BodyColor;
  hairColor: HairColor;
  accessories: Accessories;
};

/** Nome da PESSOA e aparência do seu mascote (não confundir com a fábrica). */
export type Profile = MascotLook & { name: string };

export type FactoryModelId =
  | "engrenagem"
  | "castelo"
  | "palacio-dourado"
  | "rosquinha"
  | "chale"
  | "cupula"
  | "torre-torta"
  | "realeza"
  | "cogumelo"
  | "relogio";

export type BackgroundId = "noite-cacau" | "palco-rosa" | "raios-dourados" | "rio-de-calda" | "festa-uva";

/** Modelo e fundo são escolhas independentes. */
export type FactoryIdentity = {
  name: string;
  model: FactoryModelId;
  background: BackgroundId;
};
