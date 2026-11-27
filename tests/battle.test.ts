import assert from "node:assert/strict";
import { test } from "node:test";
import { canStartBattle, confirmRepresentative, endBattle, selectRepresentative, startBattle } from "../src/lib/battle.ts";
import { createDefaultState, sanitizeState, setFactory, setProfile } from "../src/lib/demo-state.ts";
import { buildTeams, USER_ID } from "../src/lib/mock-data.ts";

test("selecionar e confirmar não aumentam o contador", () => {
  let state = createDefaultState();
  const before = { ...state.participation };
  state = selectRepresentative(state, "t1", "t1-2");
  state = confirmRepresentative(state, "t1");
  assert.deepEqual(state.participation, before);
});

test("a escolha pode mudar antes do início e a troca exige nova confirmação", () => {
  let state = confirmRepresentative(selectRepresentative(createDefaultState(), "t1", "t1-2"), "t1");
  state = selectRepresentative(state, "t1", "t1-3");
  assert.equal(state.battle.representatives.t1, "t1-3");
  assert.equal(state.battle.confirmed.t1, false);
  assert.equal(canStartBattle(state), false);
  assert.equal(startBattle(state), state);
});

test("só o início confirmado pelo moderador conta, uma única vez", () => {
  let state = confirmRepresentative(selectRepresentative(createDefaultState(), "t1", "t1-2"), "t1");
  state = startBattle(state);
  assert.equal(state.participation["t1-2"], 2);
  assert.equal(state.participation["t2-2"], 1);
  assert.equal(startBattle(state), state);
  assert.equal(selectRepresentative(state, "t1", "t1-3"), state);
  const ended = endBattle(state);
  assert.equal(ended.participation["t1-2"], 2);
  assert.equal(ended.battle.representatives.t1, null);
});

test("não aceita representante de outra equipe", () => {
  const state = createDefaultState();
  assert.equal(selectRepresentative(state, "t1", "t2-2"), state);
});

test("a personalização aparece na fábrica do usuário, e só nela", () => {
  let state = setProfile(createDefaultState(), { name: "Marina", color: "azul" });
  state = setFactory(state, { name: "Brigadeiro Veloz", model: "cogumelo", background: "festa-uva" });
  const [mine, ...others] = buildTeams(state);
  assert.equal(mine.name, "Brigadeiro Veloz");
  assert.equal(mine.model, "cogumelo");
  assert.equal(mine.participants[0].id, USER_ID);
  assert.equal(mine.participants[0].name, "Marina");
  assert.notEqual(mine.participants[0].name, mine.name);
  assert.ok(others.every((team) => team.name !== "Brigadeiro Veloz"));
});

test("estado salvo sobrevive à ida e volta em JSON e descarta lixo", () => {
  let state = setProfile(createDefaultState(), { name: "Ana", accessories: { chapeu: "coroa" } });
  state = startBattle(confirmRepresentative(selectRepresentative(state, "t1", "t1-4"), "t1"));
  assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(state))), state);

  const dirty = sanitizeState({
    profile: { name: 42, color: "roxo", accessories: { chapeu: "capacete", traje: "capa" } },
    factory: { model: "foguete" },
    battle: { started: true, representatives: { t1: "zzz" }, confirmed: {} },
    participation: { "t1-2": -3, "t1-3": 2 },
  });
  assert.deepEqual(dirty.profile, { name: "", color: "rosa", hairColor: "castanho", accessories: { traje: "capa" } });
  assert.equal(dirty.factory.model, "engrenagem");
  assert.equal(dirty.battle.started, false);
  assert.deepEqual(dirty.participation, { "t1-3": 2 });
  assert.deepEqual(sanitizeState("quebrado"), createDefaultState());
});
