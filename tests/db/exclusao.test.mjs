// Exclusão de salas: autorização, alcance, repetição, concorrência e o aviso
// que permite aos aparelhos reconhecer uma sala apagada.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createTestDatabase, runAs } from "./database.mjs";
import { call, createGame, finishRound, pickAll, rejects, startMatch, toPreparation } from "./game.mjs";

let db;
before(async () => (db = await createTestDatabase()));
after(async () => db?.close());

const remove = (user, roomId) => call(db, user, "dc_delete_room", [roomId]);
const gone = (user, code) => call(db, user, "dc_room_gone", [code]);

/** Linhas da sala em TODAS as tabelas do jogo (inclui tabelas criadas no futuro). */
async function footprint(roomId) {
  const { rows: tables } = await db.pool.query(
    `select table_name from information_schema.columns
     where table_schema = 'dominacao' and column_name = 'room_id' and table_name <> 'deleted_rooms'
     order by table_name`);
  const counts = { rooms: (await db.pool.query("select 1 from dominacao.rooms where id = $1", [roomId])).rowCount };
  for (const { table_name: table } of tables) {
    const { rows } = await db.pool.query(`select count(*)::int as n from dominacao.${table} where room_id = $1`, [roomId]);
    counts[table] = rows[0].n;
  }
  return counts;
}

const empty = (counts) => Object.values(counts).every((n) => n === 0);

/** Partida com espionagem, cartas com alvo, bônus, pagamento e segunda rodada. */
async function richGame() {
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
  await game.mod("register_special", { teamId: a.id, power: "plus4" });
  await finishRound(game);
  await game.mod("next_round");
  await toPreparation(game);
  // Fica uma espionagem autorizada e ainda não usada.
  await game.mod("register_combo", { teamId: c.id, power: "blue" });
  return game;
}

test("sala no lobby: o criador apaga, e os aparelhos reconhecem que ela deixou de existir", async () => {
  const game = await createGame(db, 3);
  const screen = (await game.join("", "screen")).user;
  const stranger = randomUUID();
  assert.deepEqual(await gone(game.players[0].user, game.code), { gone: false, wasMember: false });

  assert.deepEqual(await remove(game.moderator, game.roomId), { ok: true, repeated: false });
  assert.ok(empty(await footprint(game.roomId)));

  for (const user of [game.moderator, screen, ...game.players.map((p) => p.user)]) {
    assert.deepEqual(await game.snapshot(user), { ok: false, error: "not_member" });
    assert.deepEqual(await gone(user, game.code), { gone: true, wasMember: true });
    assert.deepEqual(await call(db, user, "dc_my_rooms", []), []);
  }
  assert.deepEqual(await gone(stranger, ` ${game.code.toLowerCase()} `), { gone: true, wasMember: false });
});

test("convite antigo: não recria a sala nem deixa entrar, e o código não é reaproveitado", async () => {
  const game = await createGame(db, 1);
  await remove(game.moderator, game.roomId);
  for (const as of ["player", "screen"]) {
    assert.deepEqual(await call(db, randomUUID(), "dc_join_room", [game.code, as, "Atrasado", "{}"]),
      { ok: false, error: "room_not_found" });
  }
  await rejects(game.command(game.players[0].user, "set_look", { name: "x", look: {} }), "not_member");
  await rejects(game.mod("set_entries", { open: true }), "not_member");
  await rejects(call(db, game.moderator, "dc_spy", [game.roomId, 1]), "not_member");
  const reuse = await db.pool.query(
    "insert into dominacao.rooms (code, created_by) values ($1, gen_random_uuid()) on conflict (code) do nothing returning id",
    [game.code]);
  assert.equal(reuse.rowCount, 0, "código reservado");
});

test("partida em andamento com espionagem e cartas com alvo: não sobra nada e a outra sala fica intacta", async () => {
  const game = await richGame();
  const other = await richGame();
  const before = await footprint(game.roomId);
  for (const table of ["teams", "members", "rounds", "round_teams", "cases", "case_contents", "power_uses",
                       "spy_grants", "payments", "events", "commands"]) {
    assert.ok(before[table] > 0, `o cenário precisa ter linhas em ${table}`);
  }
  const otherBefore = { rows: await footprint(other.roomId), state: await other.snapshot() };

  await remove(game.moderator, game.roomId);

  assert.ok(empty(await footprint(game.roomId)), JSON.stringify(await footprint(game.roomId)));
  assert.deepEqual(await footprint(other.roomId), otherBefore.rows);
  assert.deepEqual(await other.snapshot(), otherBefore.state);
  await other.mod("close_preparation", { force: true });
});

test("partida encerrada pode ser apagada", async () => {
  const game = await createGame(db, 4);
  await startMatch(game, 2);
  await toPreparation(game);
  await pickAll(game);
  await game.mod("reveal");
  await finishRound(game);
  await game.mod("end_match");
  assert.equal((await game.snapshot()).room.status, "ended");
  assert.deepEqual(await remove(game.moderator, game.roomId), { ok: true, repeated: false });
  assert.ok(empty(await footprint(game.roomId)));
});

test("quem entrou em duas salas continua na outra", async () => {
  const first = await createGame(db, 0);
  const second = await createGame(db, 0);
  const person = randomUUID();
  const look = JSON.stringify({ color: "verde" });
  for (const game of [first, second]) {
    assert.equal((await call(db, person, "dc_join_room", [game.code, "player", "Bia", look])).ok, true);
  }
  await remove(first.moderator, first.roomId);
  const mine = await call(db, person, "dc_my_rooms", []);
  assert.deepEqual(mine.map((room) => room.code), [second.code]);
  const state = await second.snapshot(person);
  assert.equal(state.members.find((m) => m.id === state.me.memberId).look.color, "verde");
});

test("só o criador apaga: capitão, participante, telão, outra sala e estranho são recusados", async () => {
  const game = await createGame(db, 4);
  const other = await createGame(db, 2);
  const screen = (await game.join("", "screen")).user;
  await startMatch(game, 2);
  const captain = game.teams[0].captain.user;
  const member = game.teams[0].members.find((m) => m.user !== captain).user;
  const before = { rows: await footprint(game.roomId), revision: (await game.snapshot()).room.revision };

  for (const user of [captain, member, screen]) await rejects(remove(user, game.roomId), "moderator_only");
  for (const user of [other.moderator, other.players[0].user, randomUUID()]) {
    await rejects(remove(user, game.roomId), "not_member");
  }
  await rejects(remove(game.moderator, randomUUID()), "not_member");
  await rejects(remove(game.moderator, null), "bad_arguments");
  await assert.rejects(runAs(db.pool, null, "select public.dc_delete_room($1)", [game.roomId], "anon"), /permission denied/);
  await rejects(runAs(db.pool, null, "select public.dc_delete_room($1)", [game.roomId]), "unauthenticated");

  assert.deepEqual(await footprint(game.roomId), before.rows);
  assert.equal((await game.snapshot()).room.revision, before.revision);
  assert.deepEqual(await gone(captain, game.code), { gone: false, wasMember: false });
});

test("ser moderador sem ter criado a sala não basta", async () => {
  const game = await createGame(db, 1);
  // Situação que o aplicativo não produz; a regra confere as duas coisas.
  await db.pool.query("update dominacao.members set kind = 'moderator' where id = $1", [game.players[0].id]);
  await rejects(remove(game.players[0].user, game.roomId), "moderator_only");
  assert.equal((await footprint(game.roomId)).rooms, 1);
});

test("pedido repetido não tem efeito extra e não autoriza mais ninguém", async () => {
  const game = await richGame();
  const results = await Promise.all(Array.from({ length: 6 }, () => remove(game.moderator, game.roomId)));
  assert.equal(results.filter((r) => r.repeated === false).length, 1);
  assert.ok(results.every((r) => r.ok));
  assert.deepEqual(await remove(game.moderator, game.roomId), { ok: true, repeated: true });
  for (const user of [game.teams[0].captain.user, game.players[7].user, randomUUID()]) {
    await rejects(remove(user, game.roomId), "not_member");
  }
  const { rows } = await db.pool.query("select count(*)::int as n from dominacao.deleted_rooms where room_id = $1", [game.roomId]);
  assert.equal(rows[0].n, 1);
});

test("a exclusão avisa o canal uma vez, só com a revisão", async () => {
  const game = await createGame(db, 2);
  const { revision } = (await game.snapshot()).room;
  const notices = async () => (await db.pool.query(
    "select payload from realtime.messages where topic = $1 order by (payload->>'revision')::int",
    [`dominacao:${game.roomId}`])).rows.map((row) => row.payload);
  const count = (await notices()).length;
  await remove(game.moderator, game.roomId);
  await remove(game.moderator, game.roomId);
  const after = await notices();
  assert.equal(after.length, count + 1);
  assert.deepEqual(after.at(-1), { revision: revision + 1 });
});

test("exclusão concorrendo com comandos e entradas: sem impasse e sem sobras", async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const game = await createGame(db, 4);
    await startMatch(game, 2);
    const outcomes = await Promise.allSettled([
      game.mod("set_entries", { open: true }),
      call(db, randomUUID(), "dc_join_room", [game.code, "screen", "", "{}"]),
      remove(game.moderator, game.roomId),
      game.command(game.teams[0].captain.user, "select_representative",
        { memberId: game.teams[0].members.at(-1).id }),
      game.mod("set_entries", { open: false }),
    ]);
    assert.equal(outcomes[2].status, "fulfilled", outcomes[2].reason?.message);
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") assert.equal(outcome.reason.message, "dc:not_member");
    }
    assert.ok(empty(await footprint(game.roomId)));
  }
});

test("minhas salas: lista só o que a pessoa criou, em qualquer estado", async () => {
  const owner = randomUUID();
  const created = [];
  for (let i = 0; i < 3; i += 1) created.push(await call(db, owner, "dc_create_room", [randomUUID()]));
  const foreign = await createGame(db, 0);
  await call(db, owner, "dc_join_room", [foreign.code, "player", "Convidada", "{}"]);
  await db.pool.query("update dominacao.rooms set status = 'ended' where id = $1", [created[0].roomId]);

  const list = await call(db, owner, "dc_owned_rooms", []);
  assert.deepEqual(list.map((r) => r.code), [...created].reverse().map((r) => r.code));
  assert.deepEqual(Object.keys(list[0]).sort(), ["code", "createdAt", "players", "roomId", "round", "status"]);
  assert.equal(list.at(-1).status, "ended");
  assert.deepEqual((await call(db, foreign.moderator, "dc_owned_rooms", [])).map((r) => [r.code, r.players]),
    [[foreign.code, 1]]);

  await remove(owner, created[1].roomId);
  assert.deepEqual((await call(db, owner, "dc_owned_rooms", [])).map((r) => r.code),
    [created[2].code, created[0].code]);
});

test("sem entrar, a única função disponível é saber se um convite acabou", async () => {
  const { rows } = await db.pool.query(
    `select n.nspname || '.' || p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where (n.nspname = 'dominacao' or (n.nspname = 'public' and p.proname like 'dc\\_%'))
       and has_function_privilege('anon', p.oid, 'execute') order by 1`);
  assert.deepEqual(rows.map((r) => r.name), ["dominacao.room_gone", "public.dc_room_gone"]);

  const visitor = async (sql, params) => (await runAs(db.pool, null, sql, params, "anon"))[0].r;
  const game = await createGame(db, 1);
  assert.deepEqual(await visitor("select public.dc_room_gone($1) as r", [game.code]), { gone: false, wasMember: false });
  await remove(game.moderator, game.roomId);
  assert.deepEqual(await visitor("select public.dc_room_gone($1) as r", [game.code]), { gone: true, wasMember: false });
  for (const table of ["rooms", "members", "deleted_rooms"]) {
    await assert.rejects(runAs(db.pool, null, `select * from dominacao.${table}`, [], "anon"), /permission denied/);
  }
  await assert.rejects(runAs(db.pool, game.moderator, "select * from dominacao.deleted_rooms"), /permission denied/);
});
