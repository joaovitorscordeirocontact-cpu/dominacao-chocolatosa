import assert from "node:assert/strict";
import { test } from "node:test";
import { TEAM_IDS } from "../src/lib/catalog.ts";
import { createDefaultState, sanitizeState } from "../src/lib/demo-state.ts";
import {
  addBonus,
  autoPick,
  backToBoard,
  caseResult,
  openCases,
  pickCase,
  rotateCases,
  showDuel,
  swapCases,
} from "../src/lib/stage.ts";
import type { DemoState } from "../src/lib/types.ts";

function duel(): DemoState {
  let state = createDefaultState();
  [7, 18, 33, 60].forEach((n, index) => {
    state = pickCase(state, TEAM_IDS[index], n);
  });
  return showDuel(state);
}
const picks = (state: DemoState) => TEAM_IDS.map((id) => state.stage.picks[id]);

test("maleta escolhida fica indisponível para as outras fábricas", () => {
  const state = pickCase(createDefaultState(), "t1", 7);
  assert.equal(pickCase(state, "t2", 7), state);
  assert.equal(pickCase(state, "t1", 7).stage.picks.t1, null);
  assert.equal(pickCase(state, "t1", 9).stage.picks.t1, 9);
  assert.equal(pickCase(state, "t2", 61), state);
});

test("confronto exige as quatro escolhas", () => {
  const state = pickCase(createDefaultState(), "t1", 1);
  assert.equal(showDuel(state), state);
  const filled = autoPick(state, () => 0);
  assert.equal(new Set(picks(filled)).size, 4);
  assert.equal(filled.stage.picks.t1, 1);
});

test("inversão avança todas as maletas uma posição; quatro inversões voltam ao início", () => {
  let state = rotateCases(duel());
  assert.deepEqual(picks(state), [60, 7, 18, 33]);
  for (let i = 0; i < 3; i++) state = rotateCases(state);
  assert.deepEqual(picks(state), [7, 18, 33, 60]);
});

test("coringa troca apenas as duas maletas indicadas", () => {
  assert.deepEqual(picks(swapCases(duel(), "t1", "t3")), [33, 18, 7, 60]);
  const state = duel();
  assert.equal(swapCases(state, "t2", "t2"), state);
});

test("o bônus fica na fábrica depois de inversões e trocas", () => {
  let state = addBonus(addBonus(duel(), "t1", 4), "t3", 2);
  state = addBonus(state, "t1", 2);
  state = swapCases(rotateCases(openCases(state)), "t1", "t2");
  assert.deepEqual(state.stage.bonuses, { t1: 6, t2: 0, t3: 2, t4: 0 });
});

test("o resultado acompanha a maleta e a abertura não pode ser desfeita", () => {
  const opened = openCases(duel());
  const before = caseResult(opened.stage.picks.t1!);
  const rotated = rotateCases(opened);
  assert.equal(caseResult(rotated.stage.picks.t2!), before);
  assert.equal(rotated.stage.revealed, true);
  assert.equal(backToBoard(opened), opened);
  assert.equal(pickCase(opened, "t1", 2), opened);
});

test("estado do palco persiste; duplicatas salvas são descartadas", () => {
  const state = openCases(addBonus(duel(), "t4", 4));
  assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(state))).stage, state.stage);
  const dirty = sanitizeState({ stage: { view: "confronto", revealed: true, picks: { t1: 5, t2: 5 } } });
  assert.equal(dirty.stage.picks.t2, null);
  assert.equal(dirty.stage.view, "escolha");
  assert.equal(dirty.stage.revealed, false);
});
