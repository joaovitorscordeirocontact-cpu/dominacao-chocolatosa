/** Dados FICTÍCIOS da demonstração local. Nenhum participante é real. */
import type { Accessories, BodyColor, DemoState, HairColor, Participant, Team, TeamId } from "./types.ts";

/** Id fixo do usuário, que é o capitão da equipe t1 na demonstração. */
export const USER_ID = "t1-capitao";

function person(
  id: string,
  name: string,
  color: BodyColor,
  accessories: Accessories = {},
  isCaptain = false,
  hairColor: HairColor = "castanho",
): Participant {
  return { id, name, color, hairColor, accessories, isCaptain };
}

/** Colegas fictícios da fábrica do usuário (o capitão vem do perfil salvo). */
const USER_TEAMMATES: Participant[] = [
  person("t1-2", "Bia", "verde", { enfeite: "laco" }),
  person("t1-3", "Caio", "azul", { chapeu: "bone" }),
  person("t1-4", "Duda", "marrom", { cabelo: "cabelo-longo" }),
  person("t1-5", "Enzo", "branco", { olhos: "oculos-redondos", traje: "gravata" }),
  person("t1-6", "Lia", "chocolate", { chapeu: "aureola" }),
];

type FictionalTeam = Omit<Team, "id"> & { id: Exclude<TeamId, "t1"> };

const OTHER_TEAMS: FictionalTeam[] = [
  {
    id: "t2",
    name: "Cacau Real",
    model: "castelo",
    background: "raios-dourados",
    participants: [
      person("t2-1", "Rafa", "azul", { chapeu: "coroa", traje: "capa" }, true),
      person("t2-2", "Nina", "rosa", { chapeu: "chapeu-chef" }),
      person("t2-3", "Theo", "chocolate", { olhos: "oculos-escuros" }),
      person("t2-4", "Manu", "branco", { cabelo: "cabelo-curto" }, false, "loiro"),
      person("t2-5", "Igor", "verde", { pelos: "bigode", chapeu: "cartola" }),
    ],
  },
  {
    id: "t3",
    name: "Doce Cúpula",
    model: "cupula",
    background: "festa-uva",
    participants: [
      person("t3-1", "Sofia", "verde", { chapeu: "chapeu-chef", olhos: "oculos-redondos" }, true),
      person("t3-2", "Davi", "marrom", { pelos: "barba" }),
      person("t3-3", "Lara", "rosa", { cabelo: "cabelo-longo", enfeite: "laco" }),
      person("t3-4", "Hugo", "azul", { olhos: "monoculo" }),
      person("t3-5", "Alice", "branco", { chapeu: "aureola", traje: "gravata" }),
    ],
  },
  {
    id: "t4",
    name: "Trufa Torta",
    model: "torre-torta",
    background: "rio-de-calda",
    participants: [
      person("t4-1", "Gui", "chocolate", { chapeu: "cartola", traje: "gravata" }, true),
      person("t4-2", "Mel", "branco", { chapeu: "bone" }),
      person("t4-3", "Otto", "verde", { cabelo: "cabelo-cacheado", olhos: "oculos-escuros" }, false, "preto"),
      person("t4-4", "Isa", "azul", { traje: "capa" }),
      person("t4-5", "Noah", "rosa", { pelos: "bigode" }),
    ],
  },
];

/** Participações iniciais fictícias, para o marcador ter variedade. */
export const INITIAL_PARTICIPATION: Record<string, number> = {
  "t1-2": 1,
  "t1-4": 2,
  "t2-1": 1,
  "t2-3": 1,
  "t3-2": 2,
  "t3-3": 1,
  "t4-4": 1,
};

/** Monta as quatro equipes, aplicando a personalização do usuário na t1. */
export function buildTeams({ profile, factory }: Pick<DemoState, "profile" | "factory">): Team[] {
  const captain: Participant = {
    id: USER_ID,
    name: profile.name.trim() || "Você",
    color: profile.color,
    hairColor: profile.hairColor,
    accessories: profile.accessories,
    isCaptain: true,
  };
  return [
    {
      id: "t1",
      ...factory,
      name: factory.name.trim() || "Sua fábrica",
      participants: [captain, ...USER_TEAMMATES],
    },
    ...OTHER_TEAMS,
  ];
}
