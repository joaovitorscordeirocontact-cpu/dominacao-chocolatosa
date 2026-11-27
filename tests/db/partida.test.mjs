// Regras da partida de ponta a ponta, no banco.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createTestDatabase } from "./database.mjs";
import {
  assertConservation, byTeam, call, createGame, finishRound, formTeams, indexTeams, pickAll, readyFactories,
  rejects, startMatch, teamOf, toPreparation,
} from "./game.mjs";

let db;
before(async () => (db = await createTestDatabase()));
after(async () => db?.close());

for (const teamCount of [2, 3, 4]) {
  test(`${teamCount} equipes: sorteio equilibrado, um capitão cada, e refazer só antes da partida`, async () => {
    const game = await createGame(db, 11);
    await rejects(game.mod("form_teams", { captainIds: [game.players[0].id] }), "team_count");
    await rejects(game.mod("form_teams", { captainIds: [game.players[0].id, game.players[0].id] }), "captains_must_differ");
    await formTeams(game, teamCount);
    const sizes = game.teams.map((t) => t.members.length);
    assert.equal(sizes.reduce((a, b) => a + b), 11);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `tamanhos ${sizes}`);
    const { members } = await game.snapshot();
    for (const team of game.teams) {
      assert.equal(members.filter((m) => m.teamId === team.id && m.isCaptain).length, 1);
    }
    assert.deepEqual(game.teams.map((t) => t.captain.id), game.players.slice(0, teamCount).map((p) => p.id));

    await game.mod("reset_teams");
    assert.equal((await game.snapshot()).room.status, "lobby");
    await formTeams(game, teamCount);
    await rejects(game.mod("form_teams", { captainIds: game.players.slice(0, teamCount).map((p) => p.id) }), "wrong_stage");
    await readyFactories(game);
    await game.mod("set_economy", { total: 500, initialPerTeam: 10 });
    await game.mod("start_match");
    await rejects(game.mod("reset_teams"), "wrong_stage");
  });
}

test("o sorteio varia (não é a ordem de entrada)", async () => {
  const seen = new Set();
  for (let i = 0; i < 8; i += 1) {
    const game = await createGame(db, 8);
    await formTeams(game, 2);
    seen.add(game.teams[0].members.map((m) => m.name).sort().join());
  }
  assert.ok(seen.size > 1);
});

test("fábricas: só a liderança edita a própria; colegas acompanham; início exige todas prontas", async () => {
  const game = await createGame(db, 6);
  await formTeams(game, 2);
  const [a, b] = game.teams;
  const member = a.members.find((m) => m !== a.captain);
  const identity = { name: "Brigadeiro Real", model: "cupula", background: "noite-cacau" };
  await rejects(game.command(member.user, "set_factory", identity), "captain_only");
  await game.command(a.captain.user, "set_factory", { ...identity, ready: false });
  const seen = (await game.snapshot(member.user)).teams.find((t) => t.id === a.id);
  assert.deepEqual([seen.name, seen.model, seen.ready], ["Brigadeiro Real", "cupula", false]);
  await rejects(game.command(a.captain.user, "set_factory", { ...identity, model: "inexistente" }), "bad_arguments");
  await rejects(game.command(a.captain.user, "set_factory", { ...identity, name: "", ready: true }), "factory_name_required");
  await game.command(a.captain.user, "set_factory", { ...identity, ready: true });
  await rejects(game.mod("start_match"), "economy_missing");
  await game.mod("set_economy", { total: 500, initialPerTeam: 10 });
  await rejects(game.mod("start_match"), "factories_not_ready");
  await game.command(b.captain.user, "set_factory", { ...identity, name: "Cacau", ready: true });
  await game.mod("start_match");
});

test("economia: reserva, bloqueio quando não cabe e distribuição fixa das 60 maletas", async () => {
  for (const [teamCount, initial] of [[2, 15], [3, 10], [4, 10]]) {
    const game = await createGame(db, teamCount);
    await formTeams(game, teamCount);
    await readyFactories(game);
    const minimum = teamCount * initial + 32 + 62;
    await game.mod("set_economy", { total: minimum - 1, initialPerTeam: initial });
    const detail = JSON.parse(await rejects(game.mod("start_match"), "economy_does_not_fit"));
    assert.equal(detail.minTotal, minimum);
    assert.equal(detail.gainBudget, 61);
    assert.equal((await game.snapshot()).cases.length, 0, "nada é gerado quando bloqueia");

    for (const total of [minimum, 237, 1000, 4999]) {
      const g = await createGame(db, teamCount);
      await startMatch(g, teamCount, total, initial);
      const contents = await g.admin("select kind, amount from dominacao.case_contents where room_id = $1", [g.roomId]);
      const count = (kind) => contents.filter((c) => c.kind === kind).length;
      assert.deepEqual([contents.length, count("gain"), count("loss"), count("loss_third"), count("zero")], [60, 30, 10, 8, 12]);
      const gains = contents.filter((c) => c.kind === "gain");
      const budget = total - teamCount * initial - 32;
      assert.ok(gains.every((c) => c.amount >= 1), "todo ganho vale ao menos 1");
      assert.ok(gains.reduce((s, c) => s + c.amount, 0) <= budget, "ganhos cabem na reserva");
      assert.ok(contents.filter((c) => c.kind === "loss").every((c) => c.amount >= 1));
      const { room } = await g.snapshot();
      assert.equal(room.bank, total - teamCount * initial);
      await assertConservation(g);
    }
  }
});

test("o conteúdo é fixado no início e embaralhado por partida", async () => {
  const layout = async (g) =>
    (await g.admin("select kind || ':' || amount as c from dominacao.case_contents where room_id = $1 order by number", [g.roomId]))
      .map((r) => r.c).join();
  const a = await createGame(db, 2); await startMatch(a, 2);
  const b = await createGame(db, 2); await startMatch(b, 2);
  assert.notEqual(await layout(a), await layout(b));
  const fixed = await layout(a);
  await toPreparation(a);
  await pickAll(a);
  await a.mod("reveal");
  await finishRound(a);
  assert.equal(await layout(a), fixed);
});

test("representantes: contador sobe uma única vez, mesmo com repetição e toque duplo", async () => {
  const game = await createGame(db, 8);
  await startMatch(game, 4);
  const [a] = game.teams;
  await rejects(game.mod("start_battle"), "representatives_missing");
  await rejects(game.command(a.captain.user, "select_representative", { memberId: game.teams[1].captain.id }), "member_not_in_team");
  for (const team of game.teams) {
    await game.command(team.captain.user, "select_representative", { memberId: team.captain.id });
    await game.command(team.captain.user, "select_representative", { memberId: team.members.at(-1).id });
  }
  const counts = async () => Object.fromEntries((await game.snapshot()).members.map((m) => [m.id, m.battles]));
  assert.ok(Object.values(await counts()).every((n) => n === 0), "selecionar não conta");

  const commandId = randomUUID();
  const same = await Promise.all([game.mod("start_battle", {}, commandId), game.mod("start_battle", {}, commandId)]);
  assert.equal(same.filter((r) => r.repeated).length, 1);
  await rejects(game.mod("start_battle"), "wrong_stage");
  await rejects(game.command(a.captain.user, "select_representative", { memberId: a.captain.id }), "wrong_stage");
  const after = await counts();
  for (const team of game.teams) assert.equal(after[team.members.at(-1).id], 1);
  assert.equal(Object.values(after).reduce((x, y) => x + y), 4);
});

test("classificação e ordem precisam listar todas as equipes", async () => {
  const game = await createGame(db, 6);
  await startMatch(game, 3);
  for (const team of game.teams) await game.command(team.captain.user, "select_representative", { memberId: team.captain.id });
  await rejects(game.mod("record_battle", { ranking: [], playOrder: [] }), "wrong_stage");
  await game.mod("start_battle");
  const ids = game.teams.map((t) => t.id);
  await rejects(game.mod("record_battle", { ranking: ids.slice(1), playOrder: ids }), "order_must_list_all_teams");
  await rejects(game.mod("record_battle", { ranking: ids, playOrder: [ids[0], ids[0], ids[1]] }), "order_must_list_all_teams");
  await game.mod("record_battle", { ranking: ids, playOrder: [...ids].reverse() });
  await game.mod("record_battle", { ranking: ids, playOrder: ids });  // correção ainda permitida
  const rows = byTeam((await game.snapshot()).roundTeams);
  assert.deepEqual(ids.map((id) => [rows[id].battlePlace, rows[id].playPosition]), [[1, 1], [2, 2], [3, 3]]);
});

test("combinações: uma por equipe por rodada, alvo quando preciso e desfazer só o reversível", async () => {
  const game = await createGame(db, 6);
  await startMatch(game, 3);
  await rejects(game.mod("register_combo", { teamId: game.teams[0].id, power: "green" }), "wrong_stage");
  await toPreparation(game);
  const [a, b, c] = game.teams;
  await rejects(game.mod("register_combo", { teamId: a.id, power: "yellow" }), "target_required");
  await rejects(game.mod("register_combo", { teamId: a.id, power: "red", targetTeamId: a.id }), "target_required");
  await rejects(game.mod("register_combo", { teamId: a.id, power: "invert" }), "bad_arguments");
  await game.mod("register_combo", { teamId: a.id, power: "green" });
  await rejects(game.mod("register_combo", { teamId: a.id, power: "blue" }), "combo_already_used");
  await game.mod("register_combo", { teamId: b.id, power: "red", targetTeamId: c.id });
  await game.mod("undo_combo", { teamId: a.id });
  await game.mod("register_combo", { teamId: a.id, power: "blue" });
  await game.mod("undo_combo", { teamId: a.id });
  await rejects(call(db, a.captain.user, "dc_spy", [game.roomId, 1]), "spy_not_authorized");
  const history = (await game.snapshot()).history;
  assert.ok(history.some((e) => e.type === "register_combo" && e.data.power === "red" && e.data.targetTeamId === c.id));
});

test("espionagem azul: privada, de uma única maleta, recuperável e fora do histórico", async () => {
  const game = await createGame(db, 9);
  await startMatch(game, 3);
  await toPreparation(game);
  const [a, b] = game.teams;
  const member = a.members.find((m) => m !== a.captain);
  await rejects(call(db, a.captain.user, "dc_spy", [game.roomId, 7]), "spy_not_authorized");
  await game.mod("register_combo", { teamId: a.id, power: "blue" });
  await rejects(call(db, member.user, "dc_spy", [game.roomId, 7]), "captain_only");
  await rejects(call(db, b.captain.user, "dc_spy", [game.roomId, 7]), "spy_not_authorized");
  await rejects(call(db, game.moderator, "dc_spy", [game.roomId, 7]), "captain_only");
  await rejects(call(db, a.captain.user, "dc_spy", [game.roomId, 61]), "case_unavailable");
  const before = (await game.snapshot()).room.revision;

  // Dois pedidos simultâneos da mesma maleta: a mesma resposta, uma espiada.
  const [first, second] = await Promise.all([
    call(db, a.captain.user, "dc_spy", [game.roomId, 7]), call(db, a.captain.user, "dc_spy", [game.roomId, 7]),
  ]);
  const [secret] = await game.admin("select kind, amount from dominacao.case_contents where room_id = $1 and number = 7", [game.roomId]);
  for (const answer of [first, second]) assert.deepEqual([answer.number, answer.kind, answer.amount], [7, secret.kind, secret.amount]);
  assert.equal([first, second].filter((r) => r.repeated).length, 1);
  assert.equal((await game.snapshot()).room.revision, before + 1);
  await rejects(call(db, a.captain.user, "dc_spy", [game.roomId, 8]), "spy_already_used");
  await rejects(game.mod("undo_combo", { teamId: a.id }), "spy_already_seen");

  assert.deepEqual((await call(db, a.captain.user, "dc_my_spies", [game.roomId])).map((s) => s.number), [7]);
  for (const other of [game.moderator, member.user, b.captain.user]) {
    assert.deepEqual(await call(db, other, "dc_my_spies", [game.roomId]), []);
  }
  const snapshot = await game.snapshot(b.captain.user);
  const spyEvent = snapshot.history.find((e) => e.type === "spy_used");
  assert.deepEqual(spyEvent.data, { teamId: a.id }, "o histórico não diz qual maleta");
  assert.equal(snapshot.cases[6].state, "available", "espiar não reserva");
  assert.equal(snapshot.cases[6].kind, null);
  const messages = await game.admin("select payload from realtime.messages where topic = $1", [`dominacao:${game.roomId}`]);
  assert.ok(messages.every((m) => Object.keys(m.payload).join() === "revision"));
  const commands = await game.admin("select result from dominacao.commands where room_id = $1", [game.roomId]);
  assert.ok(commands.every((c) => !("kind" in c.result) && !("amount" in c.result)));

  // Depois da preparação, a consulta feita continua recuperável.
  await game.mod("close_preparation");
  assert.equal((await call(db, a.captain.user, "dc_spy", [game.roomId, 7])).repeated, true);
});

test("espionagem pendente impede fechar a preparação sem confirmação; troca de capitão", async () => {
  const game = await createGame(db, 6);
  await startMatch(game, 2);
  await toPreparation(game);
  const [a] = game.teams;
  const newCaptain = a.members.find((m) => m !== a.captain);
  await game.mod("register_combo", { teamId: a.id, power: "blue" });
  await game.mod("set_captain", { teamId: a.id, memberId: newCaptain.id });
  await rejects(call(db, a.captain.user, "dc_spy", [game.roomId, 3]), "captain_only");
  await rejects(game.mod("close_preparation"), "spy_pending");
  assert.equal((await call(db, newCaptain.user, "dc_spy", [game.roomId, 3])).ok, true);
  await game.mod("close_preparation");

  const other = await createGame(db, 4);
  await startMatch(other, 2);
  await toPreparation(other);
  await other.mod("register_combo", { teamId: other.teams[0].id, power: "blue" });
  await other.mod("close_preparation", { force: true });
  await rejects(call(db, other.teams[0].captain.user, "dc_spy", [other.roomId, 3]), "wrong_stage");
});

test("escolha: respeita a ordem, indisponibiliza a maleta e permite desfazer antes de revelar", async () => {
  const game = await createGame(db, 6);
  await startMatch(game, 3);
  const order = [game.teams[2].id, game.teams[0].id, game.teams[1].id];
  await toPreparation(game, order);
  await rejects(game.command(teamOf(game, order[0]).captain.user, "pick_case", { number: 5 }), "wrong_stage");
  await game.mod("close_preparation");
  const [first, second, third] = order.map((id) => teamOf(game, id));
  await rejects(game.command(second.captain.user, "pick_case", { number: 5 }), "not_your_turn");
  await rejects(game.command(first.captain.user, "pick_case", { number: 0 }), "case_unavailable");
  await rejects(game.command(first.captain.user, "pick_case", { number: "5" }), "bad_arguments");
  await rejects(game.mod("reveal"), "picks_missing");
  await game.command(first.captain.user, "pick_case", { number: 5 });
  await rejects(game.command(second.captain.user, "pick_case", { number: 5 }), "case_unavailable");
  await rejects(game.command(first.captain.user, "pick_case", { number: 6 }), "not_your_turn");
  await game.command(second.captain.user, "pick_case", { number: 6 });
  await game.mod("undo_pick");
  let snapshot = await game.snapshot();
  assert.equal(snapshot.cases[5].state, "available");
  await game.command(second.captain.user, "pick_case", { number: 9 });
  await game.command(third.captain.user, "pick_case", { number: 6 });
  await rejects(game.command(third.captain.user, "pick_case", { number: 10 }), "all_picked");
  snapshot = await game.snapshot();
  assert.deepEqual(snapshot.cases.filter((c) => c.state === "chosen").map((c) => c.number), [5, 6, 9]);
  assert.ok(snapshot.cases.every((c) => c.kind === null), "escolhidas continuam fechadas");
});

test("concorrência: pedidos simultâneos nunca entregam a mesma maleta a duas fábricas", async () => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const game = await createGame(db, 4);
    await startMatch(game, 2);
    await toPreparation(game);
    await game.mod("close_preparation");
    const [a, b] = game.teams;
    const results = await Promise.allSettled([
      game.command(a.captain.user, "pick_case", { number: 11 }),
      game.command(b.captain.user, "pick_case", { number: 11 }),
      game.command(a.captain.user, "pick_case", { number: 12 }),
    ]);
    const rows = (await game.snapshot()).roundTeams.map((r) => r.caseNumber).filter((n) => n !== null);
    assert.equal(new Set(rows).size, rows.length);
    assert.equal(rows.length, results.filter((r) => r.status === "fulfilled").length);
  }
  // A restrição do banco também barra a duplicata, mesmo fora das funções.
  const game = await createGame(db, 4);
  await startMatch(game, 2);
  await assert.rejects(game.admin("update dominacao.round_teams set case_number = 1 where room_id = $1", [game.roomId]), /unique/);
});

/** Deixa conteúdos conhecidos nas maletas indicadas (somente o teste faz isso). */
async function plant(game, contents) {
  for (const [number, kind, amount] of contents) {
    await game.admin("update dominacao.case_contents set kind = $3, amount = $4 where room_id = $1 and number = $2",
      [game.roomId, number, kind, amount]);
  }
}

for (const teamCount of [2, 3, 4]) {
  test(`inversão com ${teamCount} equipes: maletas avançam na ordem; saldos, bônus e proteção ficam`, async () => {
    const game = await createGame(db, teamCount * 2);
    await startMatch(game, teamCount);
    const order = game.teams.map((t) => t.id).reverse();
    await toPreparation(game, order);
    await plant(game, [[1, "gain", 7], [2, "loss", 4], [3, "loss_third", 0], [4, "zero", 0]]);
    await pickAll(game, [1, 2, 3, 4].slice(0, teamCount));
    await rejects(game.mod("register_special", { teamId: order[0], power: "invert" }), "wrong_stage");
    await game.mod("reveal");
    await game.mod("register_special", { teamId: order[0], power: "plus4" });
    const caseOf = async () => {
      const rows = byTeam((await game.snapshot()).roundTeams);
      return order.map((id) => rows[id].caseNumber);
    };
    const initial = await caseOf();
    await game.mod("register_special", { teamId: order[1], power: "invert" });
    assert.deepEqual(await caseOf(), [initial.at(-1), ...initial.slice(0, -1)]);
    const rows = byTeam((await game.snapshot()).roundTeams);
    assert.equal(rows[order[0]].bonus, 4, "bônus não viaja");
    assert.deepEqual(order.slice(1).map((id) => rows[id].bonus), order.slice(1).map(() => 0));
    assert.ok(order.every((id) => rows[id].startBalance === 10));
    await game.mod("undo_special");
    assert.deepEqual(await caseOf(), initial);
  });
}

test("coringa, bloqueio, bônus, perdas proporcionais e conferência", async () => {
  const game = await createGame(db, 8);
  await startMatch(game, 4, 500, 10);
  const [a, b, c, d] = game.teams.map((t) => t.id);
  await toPreparation(game, [a, b, c, d]);
  await plant(game, [[1, "loss_third", 0], [2, "gain", 9], [3, "loss", 25], [4, "loss", 4]]);
  await pickAll(game, [1, 2, 3, 4]);
  await game.mod("reveal");
  await rejects(game.mod("register_special", { teamId: a, power: "joker" }), "target_required");
  await game.mod("register_special", { teamId: a, power: "joker", targetTeamId: b });  // a↔b
  await rejects(game.mod("register_special", { teamId: a, power: "block" }), "special_already_used");
  await game.mod("register_special", { teamId: d, power: "block" });
  await game.mod("register_special", { teamId: b, power: "plus2" });
  const { settlement } = await game.snapshot(game.players[5].user);
  const rows = byTeam(settlement);
  assert.deepEqual([rows[a].caseNumber, rows[a].delta, rows[a].finalBalance], [2, 9, 19]);
  assert.deepEqual([rows[b].caseNumber, rows[b].delta, rows[b].bonus, rows[b].finalBalance], [1, -3, 2, 9], "um terço de 10 = 3");
  assert.deepEqual([rows[c].delta, rows[c].finalBalance], [-10, 0], "perda fixa não gera saldo negativo");
  assert.deepEqual([rows[d].delta, rows[d].effective, rows[d].blocked, rows[d].finalBalance], [-4, 0, true, 10]);

  await rejects(game.mod("confirm_payment"), "wrong_stage");
  await game.mod("open_review");
  await rejects(game.mod("register_special", { teamId: c, power: "block" }), "wrong_stage");
  await game.mod("back_to_interference");
  await game.mod("open_review");
  const bankBefore = (await game.snapshot()).room.bank;
  const commandId = randomUUID();
  const outcomes = await Promise.allSettled([
    game.mod("confirm_payment", {}, commandId), game.mod("confirm_payment", {}, commandId),
    game.mod("confirm_payment"), game.mod("confirm_payment"),
  ]);
  assert.ok(outcomes.some((o) => o.status === "fulfilled"));
  await rejects(game.mod("confirm_payment"), "wrong_stage");
  const done = await game.snapshot();
  assert.equal(done.payments.length, 4, "um pagamento por fábrica");
  assert.deepEqual(Object.fromEntries(done.teams.map((t) => [t.id, t.balance])), { [a]: 19, [b]: 9, [c]: 0, [d]: 10 });
  assert.equal(done.room.bank, bankBefore - (9 + (-3 + 2) + -10 + 0));
  await assertConservation(game);
});

test("um terço usa o piso do saldo congelado no início da rodada (6 → 2)", async () => {
  const game = await createGame(db, 4);
  await startMatch(game, 2, 200, 6);
  await toPreparation(game);
  await plant(game, [[1, "loss_third", 0], [2, "zero", 0]]);
  await pickAll(game, [1, 2]);
  await game.mod("reveal");
  const row = (await game.snapshot()).settlement.find((s) => s.caseNumber === 1);
  assert.deepEqual([row.startBalance, row.delta, row.finalBalance], [6, -2, 4]);
});

test("15 rodadas: limites de bônus, maletas consumidas, estado temporário, contadores e encerramento", async () => {
  const game = await createGame(db, 8);
  await startMatch(game, 4, 2000, 20);
  const ids = game.teams.map((t) => t.id);
  let plus2 = 0;
  let plus4 = 0;
  const opened = new Set();
  await rejects(game.mod("end_match"), "end_after_payment");
  for (let round = 1; round <= 15; round += 1) {
    let snapshot = await game.snapshot();
    assert.equal(snapshot.room.round, round);
    assert.equal(snapshot.powers.length, 0, "poderes são por rodada");
    assert.ok(snapshot.roundTeams.every((r) => !r.representativeId && !r.caseNumber && !r.blocked && r.bonus === 0));
    const balances = Object.fromEntries(snapshot.teams.map((t) => [t.id, t.balance]));
    assert.ok(snapshot.roundTeams.every((r) => r.startBalance === balances[r.teamId]), "saldo congelado");

    await toPreparation(game);
    const free = (await game.snapshot()).cases.filter((c) => c.state === "available").map((c) => c.number);
    assert.equal(free.length, 60 - (round - 1) * 4);
    if (opened.size) {
      await game.mod("register_combo", { teamId: ids[0], power: "blue" });
      await rejects(call(db, game.teams[0].captain.user, "dc_spy", [game.roomId, [...opened][0]]), "case_unavailable");
      await game.mod("undo_combo", { teamId: ids[0] });
    }
    await pickAll(game);
    await game.mod("reveal");
    for (const teamId of ids) {
      const power = round <= 2 ? "plus2" : round === 3 ? "plus4" : "block";
      await game.mod("register_special", { teamId, power });
      if (power === "plus2") plus2 += 1;
      if (power === "plus4") plus4 += 1;
    }
    if (round === 4) {
      await game.mod("undo_special");
      await rejects(game.mod("register_special", { teamId: ids[3], power: "plus2" }), "plus2_exhausted");
      await rejects(game.mod("register_special", { teamId: ids[3], power: "plus4" }), "plus4_exhausted");
    }
    snapshot = await game.snapshot();
    assert.deepEqual(snapshot.bonusCardsUsed, { plus2, plus4 });
    for (const row of snapshot.roundTeams) opened.add(row.caseNumber);
    await finishRound(game);
    await assertConservation(game);
    assert.ok((await game.snapshot()).teams.every((t) => t.balance >= 0));
    if (round < 15) await game.mod("next_round");
  }
  assert.deepEqual([plus2, plus4], [8, 4]);
  await rejects(game.mod("next_round"), "last_round");
  assert.equal(opened.size, 60);
  const final = await game.snapshot();
  assert.ok(final.cases.every((c) => c.state === "opened"));
  assert.equal(final.members.reduce((s, m) => s + m.battles, 0), 60);
  assert.equal(final.payments.length, 60);
  await game.mod("end_match");
  const ended = await game.snapshot();
  assert.deepEqual([ended.room.status, ended.room.stage, ended.room.round], ["ended", null, 15]);
  await rejects(game.mod("next_round"), "wrong_stage");
  assert.equal((await game.join("Tarde demais")).result.error, "room_ended");
});

for (const [teamCount, cases] of [[2, 30], [3, 45]]) {
  test(`com ${teamCount} equipes a partida continua limitada a 15 rodadas (${cases} maletas)`, async () => {
    const game = await createGame(db, teamCount);
    await startMatch(game, teamCount);
    for (let round = 1; round <= 15; round += 1) {
      await toPreparation(game);
      await pickAll(game);
      await game.mod("reveal");
      await finishRound(game);
      if (round < 15) await game.mod("next_round");
    }
    await rejects(game.mod("next_round"), "last_round");
    assert.equal((await game.snapshot()).cases.filter((c) => c.state === "opened").length, cases);
    await assertConservation(game);
  });
}

test("encerrar numa rodada recém-aberta volta ao último pagamento sem perder nada", async () => {
  const game = await createGame(db, 4);
  await startMatch(game, 2);
  await toPreparation(game);
  await rejects(game.mod("end_match"), "wrong_stage");
  await pickAll(game);
  await game.mod("reveal");
  await finishRound(game);
  const paid = await game.snapshot();
  await game.mod("next_round");
  await game.mod("end_match");
  const ended = await game.snapshot();
  assert.equal(ended.room.round, 1);
  assert.deepEqual(ended.teams, paid.teams);
  assert.equal(ended.room.bank, paid.room.bank);
  await indexTeams(game);
});

test("a prévia da economia no aplicativo faz a mesma conta do banco", async () => {
  const { planEconomy } = await import("../../src/lib/room/economy.ts");
  for (const teams of [2, 3, 4]) {
    for (const [total, initial] of [[0, 0], [93, 0], [94, 0], [134, 10], [133, 10], [100, 50], [5000, 100]]) {
      const { rows } = await db.pool.query("select dominacao.economy($1, $2, $3) as plan", [total, initial, teams]);
      assert.deepEqual(rows[0].plan, planEconomy(total, initial, teams), `${teams} equipes, ${total}/${initial}`);
    }
  }
});

test("uma sala com todos os tipos de registro pode ser apagada por inteiro (limpeza)", async () => {
  const game = await createGame(db, 8);
  await startMatch(game, 4);
  const [a, b, c, d] = game.teams;
  await toPreparation(game);
  await game.mod("register_combo", { teamId: a.id, power: "blue" });
  await call(db, a.captain.user, "dc_spy", [game.roomId, 9]);
  await game.mod("register_combo", { teamId: b.id, power: "red", targetTeamId: c.id });
  await pickAll(game);
  await game.mod("reveal");
  await game.mod("register_special", { teamId: d.id, power: "joker", targetTeamId: a.id });
  await finishRound(game);
  await game.mod("next_round");

  const keep = await createGame(db, 2);
  await game.admin("delete from dominacao.rooms where id = $1", [game.roomId]);
  for (const table of ["teams", "members", "rounds", "round_teams", "cases", "case_contents", "power_uses",
                       "spy_grants", "payments", "events", "commands"]) {
    const [{ n }] = await game.admin(`select count(*)::int as n from dominacao.${table} where room_id = $1`, [game.roomId]);
    assert.equal(n, 0, table);
  }
  assert.equal((await keep.snapshot()).members.length, 3, "outras salas permanecem");
});

test("mesmo com a checagem adiada, nenhuma referência quebrada é gravada", async () => {
  const game = await createGame(db, 4);
  await startMatch(game, 2);
  const [a] = game.teams;
  // O representante não pode ser apagado enquanto a rodada aponta para ele.
  await game.command(a.captain.user, "select_representative", { memberId: a.members.at(-1).id });
  await assert.rejects(game.admin("delete from dominacao.members where id = $1", [a.members.at(-1).id]), /foreign key/);
  await assert.rejects(game.admin("delete from dominacao.teams where id = $1", [a.id]), /foreign key/);
});
