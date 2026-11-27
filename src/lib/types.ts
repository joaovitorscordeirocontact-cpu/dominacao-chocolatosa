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

export type TeamId = "t1" | "t2" | "t3" | "t4";

export type Participant = MascotLook & {
  id: string;
  name: string;
  isCaptain: boolean;
};

export type Team = FactoryIdentity & {
  id: TeamId;
  participants: Participant[];
};

export type Battle = {
  started: boolean;
  representatives: Record<TeamId, string | null>;
  confirmed: Record<TeamId, boolean>;
};

/** Preferências visuais da demonstração. */
export type Settings = {
  /** Exibe a identificação opcional "Atmosfera Jovem". */
  showAtmosfera: boolean;
};

export type DemoState = {
  settings: Settings;
  profile: Profile;
  /** Fábrica personalizada pelo usuário (corresponde à equipe t1). */
  factory: FactoryIdentity;
  battle: Battle;
  /** Participações em batalhas pelas cartas, por participante. */
  participation: Record<string, number>;
};
