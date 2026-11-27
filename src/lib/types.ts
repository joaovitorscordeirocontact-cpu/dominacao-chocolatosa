export type BodyColor = "azul" | "verde" | "rosa" | "chocolate" | "branco" | "marrom";

/** Cada espaço aceita um acessório por vez; espaços diferentes se combinam. */
export type AccessorySlot = "chapeu" | "cabelo" | "olhos" | "pelos" | "traje" | "enfeite";

export type AccessoryId =
  | "coroa"
  | "chapeu-chef"
  | "bone"
  | "cartola"
  | "aureola"
  | "cabelo-longo"
  | "topete-loiro"
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
  accessories: Accessories;
};

export type Profile = MascotLook & { name: string };

/** Preferências visuais da demonstração. */
export type Settings = {
  /** Exibe a identificação opcional "Atmosfera Jovem". */
  showAtmosfera: boolean;
};

export type DemoState = {
  settings: Settings;
  profile: Profile;
};
