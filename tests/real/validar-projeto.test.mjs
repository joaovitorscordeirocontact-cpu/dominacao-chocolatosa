// Validação de um projeto Supabase REAL, usando só o que o aplicativo usa: a
// URL, a chave publicável, Auth anônima, as funções dc_* e o Realtime.
//
//   npm run validar:supabase        (lê .env.local)
//
// ATENÇÃO: cria usuários anônimos e uma sala de verdade (11 usuários por
// execução, contando no limite por IP). Ao final, imprime o que foi criado e o
// SQL para apagar somente isso. Não roda no `npm run check`.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(URL_ && KEY, "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).");
assert.ok(KEY.startsWith("sb_publishable_"), "Use somente a chave publicável.");

const clients = [];
const created = { users: [], rooms: [] };

function newClient() {
  const client = createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `validacao-${clients.length}` },
  });
  clients.push(client);
  return client;
}

async function person() {
  const client = newClient();
  const { data, error } = await client.auth.signInAnonymously();
  assert.equal(error, null, `entrada anônima: ${error?.message}`);
  assert.equal(data.user.is_anonymous, true);
  created.users.push(data.user.id);
  return { client, userId: data.user.id };
}

async function call(who, fn, args) {
  const { data, error } = await who.client.rpc(fn, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code, details: error.details });
  return data;
}

const refused = (promise, code) =>
  assert.rejects(promise, (error) => (assert.equal(error.message, `dc:${code}`), true));

const game = {};
const command = (who, type, args = {}, commandId = randomUUID()) =>
  call(who, "dc_command", { p_room: game.roomId, p_command_id: commandId, p_type: type, p_args: args });
const mod = (type, args, commandId) => command(game.mod, type, args, commandId);
const snapshot = (who = game.mod) => call(who, "dc_snapshot", { p_code: game.code });

/** Assina um canal e devolve o status final e as mensagens recebidas. */
async function listen(who, topic, isPrivate = true) {
  const received = [];
  await who.client.realtime.setAuth();
  const channel = who.client
    .channel(topic, { config: { private: isPrivate } })
    .on("broadcast", { event: "changed" }, (message) => received.push(message.payload));
  const errors = [];
  const status = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve("SEM_RESPOSTA"), 15_000);
    channel.subscribe((value, error) => {
      if (error) errors.push(error.message ?? String(error));
      if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(value)) {
        clearTimeout(timer);
        resolve(value);
      }
    });
  });
  return { channel, status, received, errors };
}

const waitFor = async (condition, what, ms = 10_000) => {
  const end = Date.now() + ms;
  while (!condition()) {
    assert.ok(Date.now() < end, `tempo esgotado: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

before(async () => {
  game.mod = await person();
});

after(async () => {
  for (const client of clients) {
    await client.removeAllChannels();
    client.realtime.disconnect();
  }
  const list = (ids) => ids.map((id) => `'${id}'`).join(", ") || "null";
  console.log(`\nDADOS DE TESTE CRIADOS: ${created.rooms.length} sala(s), ${created.users.length} usuários anônimos.`);
  console.log("Para apagar somente estes registros (SQL Editor):");
  console.log(`delete from dominacao.rooms where id in (${list(created.rooms)});`);
  console.log(`delete from dominacao.join_failures where user_id in (${list(created.users)});`);
  console.log(`delete from auth.users where is_anonymous and id in (${list(created.users)});`);
});

test("sem sessão nada é executado; tabelas e schema privado não são expostos", async () => {
  const visitor = { client: newClient() };
  await assert.rejects(call(visitor, "dc_create_room", { p_command_id: randomUUID() }), /permission denied/);
  await assert.rejects(call(visitor, "dc_snapshot", { p_code: "ABCDEF" }), /permission denied/);
  for (const who of [visitor, game.mod]) {
    const direct = await who.client.from("case_contents").select("*");
    assert.ok(direct.error, "case_contents não está na API");
    const schema = await who.client.schema("dominacao").from("rooms").select("id");
    assert.equal(schema.error?.code, "PGRST106", `schema dominacao não exposto (${schema.error?.code})`);
  }
});

test("sala, convite e papéis", async () => {
  const commandId = randomUUID();
  const [a, b] = await Promise.all([
    call(game.mod, "dc_create_room", { p_command_id: commandId }),
    call(game.mod, "dc_create_room", { p_command_id: commandId }),
  ]);
  assert.equal(a.roomId, b.roomId, "toque duplo cria uma sala só");
  Object.assign(game, { roomId: a.roomId, code: a.code });
  created.rooms.push(a.roomId);

  game.players = [];
  for (let i = 1; i <= 8; i += 1) {
    const player = await person();
    const join = { p_code: game.code, p_as: "player", p_name: `Validação ${i}`, p_look: { color: "azul" } };
    assert.equal((await call(player, "dc_join_room", join)).ok, true);
    assert.equal((await call(player, "dc_join_room", join)).existing, true, "sem duplicar");
    player.id = (await snapshot(player)).me.memberId;
    game.players.push(player);
  }
  game.screen = await person();
  await call(game.screen, "dc_join_room", { p_code: game.code, p_as: "screen", p_name: "", p_look: {} });
  game.outsider = await person();

  assert.deepEqual(await snapshot(game.outsider), { ok: false, error: "not_member" });
  await refused(command(game.outsider, "set_entries", { open: false }), "not_member");
  await refused(command(game.players[0], "form_teams", { captainIds: [] }), "moderator_only");
  await refused(command(game.screen, "reveal"), "moderator_only");
  assert.equal((await snapshot()).members.filter((m) => m.kind === "player").length, 8);
});

test("Realtime: só integrantes escutam o canal privado e ninguém publica nele", async () => {
  const topic = `dominacao:${game.roomId}`;
  game.live = await listen(game.players[1], topic);
  assert.equal(game.live.status, "SUBSCRIBED", `integrante assina: ${game.live.errors.join(" | ")}`);
  const screen = await listen(game.screen, topic);
  assert.equal(screen.status, "SUBSCRIBED", `telão assina: ${screen.errors.join(" | ")}`);
  const intruder = await listen(game.outsider, topic);
  assert.equal(intruder.status, "CHANNEL_ERROR", "quem não é da sala não assina o canal privado");
  assert.match(intruder.errors.join(" "), /Unauthorized/);

  // Um canal PÚBLICO de mesmo nome não recebe os avisos privados do banco.
  const spyOnPublic = await listen({ client: newClient() }, topic, false);

  const before = game.live.received.length;
  const { revision } = await mod("set_entries", { open: false });
  await waitFor(() => game.live.received.some((p) => p.revision === revision), "aviso do banco ao integrante");
  await waitFor(() => screen.received.some((p) => p.revision === revision), "aviso do banco ao telão");

  // Um integrante tenta publicar um aviso falso: não há política de envio.
  await screen.channel.send({ type: "broadcast", event: "changed", payload: { revision: 999999, forged: true } });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  assert.ok(game.live.received.slice(before).every((p) => !p.forged), "aviso forjado não chega");
  assert.deepEqual(intruder.received, []);
  assert.deepEqual(spyOnPublic.received, [], "canal público não vê os avisos privados");
  await mod("set_entries", { open: true });
});

test("partida completa de 15 rodadas com 4 equipes", { timeout: 600_000 }, async () => {
  await mod("form_teams", { captainIds: game.players.slice(0, 4).map((p) => p.id) });
  let state = await snapshot();
  const teams = state.teams.map((team) => {
    const members = state.members.filter((m) => m.teamId === team.id);
    const captain = members.find((m) => m.isCaptain);
    return { id: team.id, members, captain: game.players.find((p) => p.id === captain.id) };
  });
  assert.deepEqual(teams.map((t) => t.members.length), [2, 2, 2, 2]);
  const ids = teams.map((t) => t.id);
  for (const [i, team] of teams.entries()) {
    await command(team.captain, "set_factory", {
      name: `Validação ${i + 1}`, model: "castelo", background: "festa-uva", ready: true,
    });
  }
  await mod("set_economy", { total: 150, initialPerTeam: 20 });
  await assert.rejects(mod("start_match"), /dc:economy_does_not_fit/);
  await mod("set_economy", { total: 2000, initialPerTeam: 20 });
  await mod("start_match");

  const opened = new Set();
  let plus2 = 0;
  let plus4 = 0;
  for (let round = 1; round <= 15; round += 1) {
    state = await snapshot();
    assert.equal(state.room.round, round);
    assert.equal(state.cases.filter((c) => c.state === "available").length, 60 - 4 * (round - 1));
    for (const team of teams) {
      await command(team.captain, "select_representative", { memberId: team.members[round % 2].id });
    }
    const startId = randomUUID();
    const starts = await Promise.all([mod("start_battle", {}, startId), mod("start_battle", {}, startId)]);
    assert.equal(starts.filter((r) => r.repeated).length, 1, "contador aplicado uma vez");
    await mod("record_battle", { ranking: ids, playOrder: ids });

    let spied = null;
    if (round === 1) {
      await mod("register_combo", { teamId: ids[0], power: "blue" });
      await refused(call(teams[1].captain, "dc_spy", { p_room: game.roomId, p_number: 33 }), "spy_not_authorized");
      const [x, y] = await Promise.all([
        call(teams[0].captain, "dc_spy", { p_room: game.roomId, p_number: 33 }),
        call(teams[0].captain, "dc_spy", { p_room: game.roomId, p_number: 33 }),
      ]);
      assert.deepEqual([x.kind, x.amount], [y.kind, y.amount]);
      await refused(call(teams[0].captain, "dc_spy", { p_room: game.roomId, p_number: 34 }), "spy_already_used");
      assert.deepEqual(await call(game.mod, "dc_my_spies", { p_room: game.roomId }), []);
      assert.deepEqual(await call(game.screen, "dc_my_spies", { p_room: game.roomId }), []);
      assert.equal((await call(teams[0].captain, "dc_my_spies", { p_room: game.roomId }))[0].number, 33);
      for (const who of [game.mod, game.screen, teams[1].captain]) {
        const seen = await snapshot(who);
        assert.ok(seen.cases.every((c) => c.kind === null && c.amount === null), "nenhum conteúdo no estado");
        assert.deepEqual(seen.history.find((e) => e.type === "spy_used").data, { teamId: ids[0] });
      }
      spied = x;
    }
    await mod("close_preparation");

    const free = (await snapshot()).cases.filter((c) => c.state === "available").map((c) => c.number);
    const numbers = round === 1 ? [33, ...free.filter((n) => n !== 33).slice(0, 3)] : free.slice(0, 4);
    if (round === 1) {
      // Duas fábricas disputam a mesma maleta ao mesmo tempo.
      const race = await Promise.allSettled([
        command(teams[0].captain, "pick_case", { number: 33 }),
        command(teams[1].captain, "pick_case", { number: 33 }),
      ]);
      assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
      const rows = (await snapshot()).roundTeams;
      assert.equal(rows.filter((r) => r.caseNumber === 33).length, 1);
    }
    for (const [i, team] of teams.entries()) {
      if (round === 1 && i === 0) continue;
      await command(team.captain, "pick_case", { number: numbers[i] });
    }
    await mod("reveal");
    state = await snapshot(game.screen);
    for (const row of state.roundTeams) opened.add(row.caseNumber);
    if (spied) {
      const revealed = state.cases.find((c) => c.number === 33);
      assert.deepEqual([revealed.kind, revealed.amount], [spied.kind, spied.amount], "conteúdo não mudou");
    }

    if (round <= 2) for (const teamId of ids) { await mod("register_special", { teamId, power: "plus2" }); plus2 += 1; }
    if (round === 3) for (const teamId of ids) { await mod("register_special", { teamId, power: "plus4" }); plus4 += 1; }
    if (round === 4) {
      await assert.rejects(mod("register_special", { teamId: ids[0], power: "plus2" }), /dc:plus2_exhausted/);
      await assert.rejects(mod("register_special", { teamId: ids[0], power: "plus4" }), /dc:plus4_exhausted/);
      const cases = async () => Object.fromEntries((await snapshot()).roundTeams.map((r) => [r.teamId, r]));
      const before = await cases();
      await mod("register_special", { teamId: ids[1], power: "invert" });
      const rotated = await cases();
      ids.forEach((id, i) => assert.equal(rotated[ids[(i + 1) % 4]].caseNumber, before[id].caseNumber, "inversão"));
      await mod("register_special", { teamId: ids[2], power: "joker", targetTeamId: ids[3] });
      const swapped = await cases();
      assert.equal(swapped[ids[2]].caseNumber, rotated[ids[3]].caseNumber, "coringa");
      await mod("register_special", { teamId: ids[3], power: "block" });
    }
    await mod("open_review");
    const expected = (await snapshot()).settlement;
    for (const row of expected) {
      const delta = { gain: row.caseAmount, loss: -Math.min(row.caseAmount, row.startBalance),
        loss_third: -Math.floor(row.startBalance / 3), zero: 0 }[row.caseKind];
      assert.equal(row.delta + 0, delta + 0, `rodada ${round}: efeito`);
      assert.equal(row.finalBalance, row.startBalance + (row.blocked && delta < 0 ? 0 : delta) + row.bonus);
    }
    const payments = await Promise.allSettled([mod("confirm_payment"), mod("confirm_payment")]);
    assert.equal(payments.filter((r) => r.status === "fulfilled").length, 1, "pagamento único");
    state = await snapshot();
    assert.equal(state.payments.filter((p) => p.round === round).length, 4);
    assert.equal(state.room.bank + state.teams.reduce((s, t) => s + t.balance, 0), 2000, "conservação");
    for (const row of expected) assert.equal(state.teams.find((t) => t.id === row.teamId).balance, row.finalBalance);
    if (round < 15) await mod("next_round");
  }

  assert.deepEqual([plus2, plus4], [8, 4]);
  assert.equal(opened.size, 60, "60 maletas usadas, nenhuma repetida");
  await assert.rejects(mod("next_round"), /dc:last_round/);
  await mod("end_match");
  state = await snapshot(game.screen);
  assert.deepEqual([state.room.status, state.room.round], ["ended", 15]);
  assert.equal(state.members.reduce((sum, m) => sum + m.battles, 0), 60);

  // O canal assinado no começo continuou entregando até o fim.
  const last = state.room.revision;
  await waitFor(() => game.live.received.some((p) => p.revision === last), "aviso do encerramento");
  assert.ok(game.live.received.every((p) => Object.keys(p).filter((k) => k !== "id").join() === "revision"),
    `avisos só com a revisão: ${JSON.stringify(game.live.received.slice(0, 2))}`);
  const revisions = new Set(game.live.received.map((p) => p.revision));
  console.log(`  Realtime: ${revisions.size} revisões recebidas pelo canal privado (última: ${last}).`);
});
