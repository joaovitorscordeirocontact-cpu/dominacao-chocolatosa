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

export type StageView = "escolha" | "confronto";

export type BonusValue = 2 | 4;

/** Último acontecimento do palco, usado como destaque no telão. */
export type StageEvent = {
  seq: number;
  message: string;
  teams: TeamId[];
};

/** Palco de DEMONSTRAÇÃO das maletas (não é a economia nem o baralho do jogo). */
export type Stage = {
  view: StageView;
  /** Maleta que está com cada fábrica (muda com inversões e trocas). */
  picks: Record<TeamId, number | null>;
  revealed: boolean;
  /** Bônus fixo: pertence à FÁBRICA e nunca acompanha a maleta. */
  bonuses: Record<TeamId, number>;
  event: StageEvent | null;
};

export type DemoState = {
  profile: Profile;
  /** Fábrica personalizada pelo usuário (corresponde à equipe t1). */
  factory: FactoryIdentity;
  battle: Battle;
  /** Participações em batalhas pelas cartas, por participante. */
  participation: Record<string, number>;
  stage: Stage;
};
