// Leituras derivadas, textos, convites e erros.
import assert from "node:assert/strict";
import { test } from "node:test";
import { GameError, toGameError } from "../src/lib/room/errors.ts";
import { planEconomy } from "../src/lib/room/economy.ts";
import { cleanCode, roomPath } from "../src/lib/room/links.ts";
import { boardCases, caseValue, standings, teamOnTurn } from "../src/lib/room/model.ts";
import type { Snapshot } from "../src/lib/room/types.ts";

test("classificação com empate divide a posição", () => {
  const table = standings([{ slot: 1, balance: 10 }, { slot: 2, balance: 25 }, { slot: 3, balance: 10 }, { slot: 4, balance: 2 }]);
  assert.deepEqual(table.map((r) => [r.team.slot, r.position]), [[2, 1], [1, 2], [3, 2], [4, 4]]);
});

test("maletas consumidas em rodadas anteriores saem do painel", () => {
  const snapshot = {
    room: { round: 3 },
    cases: [
      { number: 1, state: "opened", openedRound: 1 },
      { number: 2, state: "opened", openedRound: 3 },
      { number: 3, state: "chosen", openedRound: null },
      { number: 4, state: "available", openedRound: null },
    ],
  } as unknown as Snapshot;
  assert.deepEqual(boardCases(snapshot).map((c) => c.number), [2, 3, 4]);
});

test("a vez segue a ordem de jogada", () => {
  const snapshot = {
    room: { stage: "picking" },
    members: [],
    teams: [{ id: "a", slot: 1, name: "" }, { id: "b", slot: 2, name: "Cacau" }],
    roundTeams: [{ teamId: "a", playPosition: 2, caseNumber: null }, { teamId: "b", playPosition: 1, caseNumber: null }],
  } as unknown as Snapshot;
  assert.equal(teamOnTurn(snapshot)!.label, "Cacau");
});

test("economia: reserva de 32 e verba mínima", () => {
  assert.deepEqual([planEconomy(134, 10, 4).ok, planEconomy(133, 10, 4).ok], [true, false]);
  const plan = planEconomy(100, 20, 3);
  assert.deepEqual([plan.initialTotal, plan.bonusReserve, plan.gainBudget, plan.minTotal, plan.maxInitialPerTeam], [60, 32, 8, 154, 2]);
});

test("valores das maletas", () => {
  assert.deepEqual([caseValue("gain", 7), caseValue("loss", 4), caseValue("loss_third", 0), caseValue("zero", 0)], ["+7", "−4", "−⅓", "0"]);
});

test("código de convite é normalizado e validado", () => {
  assert.equal(cleanCode(" abc-234 "), "ABC234");
  for (const bad of ["", "ABC", "ABC10I", "ABC234X", null]) assert.equal(cleanCode(bad), "", String(bad));
  assert.equal(roomPath("moderator", "ABC234"), "/moderador/?sala=ABC234");
});

test("erros do banco, do Auth e da rede viram mensagens claras", () => {
  assert.equal(toGameError({ message: "dc:not_your_turn", details: "" }).code, "not_your_turn");
  assert.equal(toGameError(new TypeError("Failed to fetch")).code, "network");
  assert.equal(toGameError({ status: 429, message: "Request rate limit reached" }).code, "auth_rate_limit");
  assert.equal(toGameError({ code: "anonymous_provider_disabled", message: "x" }).code, "anonymous_disabled");
  assert.equal(toGameError({ message: "boom" }).code, "server");
  assert.ok(new GameError("case_unavailable").message.length > 10);
});
