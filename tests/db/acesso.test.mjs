// Identidade, convite, papéis, isolamento entre salas e grants.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createTestDatabase, runAs } from "./database.mjs";
import { call, createGame, formTeams, rejects, startMatch, toPreparation } from "./game.mjs";

let db;
before(async () => (db = await createTestDatabase()));
after(async () => db?.close());

const denied = (promise) => assert.rejects(promise, /permission denied/);

test("quem não está autenticado não executa nada", async () => {
  for (const sql of [
    "select public.dc_create_room(gen_random_uuid())",
    "select public.dc_snapshot('ABCDEF')",
    "select public.dc_join_room('ABCDEF','player','x','{}')",
    "select public.dc_my_rooms()",
  ]) {
    await denied(runAs(db.pool, null, sql, [], "anon"));
  }
  await rejects(runAs(db.pool, null, "select public.dc_create_room(gen_random_uuid())"), "unauthenticated");
});

test("criar sala é idempotente e limitado", async () => {
  const user = randomUUID();
  const commandId = randomUUID();
  const [a, b] = await Promise.all([call(db, user, "dc_create_room", [commandId]), call(db, user, "dc_create_room", [commandId])]);
  assert.equal(a.roomId, b.roomId);
  assert.match(a.code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal((await call(db, user, "dc_snapshot", [a.code])).me.kind, "moderator");
  for (let i = 0; i < 9; i += 1) await call(db, user, "dc_create_room", [randomUUID()]);
  await rejects(call(db, user, "dc_create_room", [randomUUID()]), "too_many_rooms");
});

test("o convite nunca concede moderação e não duplica integrantes", async () => {
  const game = await createGame(db, 2);
  const [player] = game.players;
  const again = await call(db, player.user, "dc_join_room", [game.code, "player", "Outro nome", "{}"]);
  assert.equal(again.existing, true);
  const asScreen = await call(db, player.user, "dc_join_room", [game.code, "screen", "", "{}"]);
  assert.equal(asScreen.kind, "player", "reentrar não muda o papel");
  const moderatorViaInvite = await call(db, game.moderator, "dc_join_room", [game.code.toLowerCase(), "player", "Mod", "{}"]);
  assert.equal(moderatorViaInvite.kind, "moderator");
  await rejects(call(db, randomUUID(), "dc_join_room", [game.code, "moderator", "x", "{}"]), "bad_arguments");
  assert.equal((await game.snapshot()).members.filter((m) => m.kind === "player").length, 2);

  for (const type of ["form_teams", "set_entries", "remove_member", "set_economy", "start_match", "start_battle",
                      "reveal", "confirm_payment", "next_round", "end_match", "register_special"]) {
    await rejects(game.command(player.user, type, { captainIds: [] }), "moderator_only");
  }
  await rejects(game.command(player.user, "unknown", {}), "unknown_command");
});

test("telão é somente leitura", async () => {
  const game = await createGame(db, 4);
  const { user, result } = await game.join("", "screen");
  assert.equal(result.kind, "screen");
  await startMatch(game, 2);
  await rejects(game.command(user, "reveal"), "moderator_only");
  await rejects(game.command(user, "pick_case", { number: 1 }), "captain_only");
  await rejects(game.command(user, "set_look", { name: "x" }), "player_only");
  await rejects(call(db, user, "dc_spy", [game.roomId, 1]), "captain_only");
  assert.deepEqual(await call(db, user, "dc_my_spies", [game.roomId]), []);
});

test("uma sala não enxerga nem altera outra", async () => {
  const mine = await createGame(db, 2);
  const other = await createGame(db, 2);
  const intruder = other.players[0].user;
  assert.deepEqual(await call(db, intruder, "dc_snapshot", [mine.code]), { ok: false, error: "not_member" });
  await rejects(call(db, intruder, "dc_command", [mine.roomId, randomUUID(), "set_look", "{}"]), "not_member");
  await rejects(call(db, other.moderator, "dc_command", [mine.roomId, randomUUID(), "set_entries", '{"open":false}']), "not_member");
  await rejects(call(db, intruder, "dc_spy", [mine.roomId, 1]), "not_member");

  // Mesmo com SELECT direto, o RLS só devolve as próprias salas.
  for (const table of ["rooms", "members", "events"]) {
    const column = table === "rooms" ? "id" : "room_id";
    const rows = await runAs(db.pool, intruder, `select ${column} as room from dominacao.${table}`);
    assert.ok(rows.length > 0 && rows.every((r) => r.room === other.roomId), table);
  }
});

test("segredos e identificadores não têm grant; tabelas não aceitam escrita direta", async () => {
  const game = await createGame(db, 4);
  await startMatch(game, 2);
  for (const user of [game.moderator, game.players[0].user]) {
    for (const table of ["case_contents", "spy_grants", "commands", "join_failures"]) {
      await denied(runAs(db.pool, user, `select * from dominacao.${table}`));
    }
    await denied(runAs(db.pool, user, "select user_id from dominacao.members"));
    await denied(runAs(db.pool, user, "select created_by from dominacao.rooms"));
    await denied(runAs(db.pool, user, "select previous from dominacao.power_uses"));
    await denied(runAs(db.pool, user, "update dominacao.teams set balance = 999"));
    await denied(runAs(db.pool, user, "update dominacao.members set kind = 'moderator'"));
    await denied(runAs(db.pool, user, "insert into dominacao.payments default values"));
    await denied(runAs(db.pool, user, "delete from dominacao.events"));
    // Helpers internos não são chamáveis.
    await denied(runAs(db.pool, user, "select dominacao.generate_cases($1, 100)", [game.roomId]));
    await denied(runAs(db.pool, user, "select dominacao.publish($1, 'x', null, '{}')", [game.roomId]));
    await denied(runAs(db.pool, user,
      "select dominacao.cmd_confirm_payment(r, null, '{}') from (select null::dominacao.rooms) t(r)"));
  }
});

test("todas as tabelas têm RLS e só as duas funções de apoio e os pontos de entrada são SECURITY DEFINER", async () => {
  const noRls = await db.pool.query(
    "select relname from pg_class where relnamespace = 'dominacao'::regnamespace and relkind = 'r' and not relrowsecurity");
  assert.deepEqual(noRls.rows, []);
  const definer = await db.pool.query(
    `select proname, proconfig from pg_proc where pronamespace in ('dominacao'::regnamespace, 'public'::regnamespace)
     and prosecdef order by proname`);
  assert.deepEqual(definer.rows.map((r) => r.proname),
    ["can_listen", "create_room", "is_member", "join_room", "my_member_id", "my_spies", "run_command", "spy", "spy_status"]);
  assert.ok(definer.rows.every((r) => r.proconfig?.some((c) => c.startsWith("search_path="))), "search_path fixo");
  const exposed = await db.pool.query(
    "select proname, prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname like 'dc\\_%'");
  assert.equal(exposed.rows.length, 7);
  assert.ok(exposed.rows.every((r) => !r.prosecdef), "a API pública é SECURITY INVOKER");
});

test("canal privado: só integrantes escutam, ninguém publica, e o aviso leva só a revisão", async () => {
  const game = await createGame(db, 2);
  const outsider = await createGame(db, 1);
  const topic = `dominacao:${game.roomId}`;
  const listen = async (user, joined = topic) => {
    const client = await db.pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true), set_config('realtime.topic', $2, true)",
        [JSON.stringify({ sub: user }), joined]);
      return (await client.query("select * from realtime.messages where topic = $1", [topic])).rows;
    } finally {
      await client.query("rollback");
      client.release();
    }
  };
  const mine = await listen(game.players[0].user);
  assert.ok(mine.length > 0);
  assert.ok(mine.every((m) => m.private === true && Object.keys(m.payload).join() === "revision"));
  assert.deepEqual(await listen(outsider.players[0].user), []);
  assert.deepEqual(await listen(game.players[0].user, "outro-app:chat"), []);
  assert.deepEqual(await listen(game.players[0].user, "dominacao:nao-e-uuid"), []);
  await assert.rejects(runAs(db.pool, game.players[0].user,
    "insert into realtime.messages (topic, payload, private) values ($1, '{}', true)", [topic]), /row-level security/);
});

test("códigos errados são contados e bloqueiam tentativas em série", async () => {
  const user = randomUUID();
  for (let i = 0; i < 20; i += 1) {
    assert.equal((await call(db, user, "dc_join_room", ["ZZZZZZ", "player", "x", "{}"])).error, "room_not_found");
  }
  assert.equal((await call(db, user, "dc_join_room", ["ZZZZZZ", "player", "x", "{}"])).error, "too_many_attempts");
});

test("aparência e nome são saneados no banco", async () => {
  const game = await createGame(db, 1);
  const [player] = game.players;
  await game.command(player.user, "set_look", {
    name: "  Maria   \u0007 Fernanda de Souza Albuquerque ",
    look: { color: "neon", hairColor: "loiro", accessories: { cabelo: "cabelo-curto", chapeu: "<script>", extra: "x" } },
  });
  const me = (await game.snapshot(player.user)).members.find((m) => m.id === player.id);
  assert.equal(me.name, "Maria Fernanda de");
  assert.deepEqual(me.look, { color: "rosa", hairColor: "loiro", accessories: { cabelo: "cabelo-curto" } });
  await rejects(game.command(player.user, "set_look", { name: "   " }), "name_required");
});

test("sala que não é a minha não aparece em Continuar partida", async () => {
  const game = await createGame(db, 1);
  const mine = await call(db, game.players[0].user, "dc_my_rooms", []);
  assert.deepEqual(mine.map((r) => [r.code, r.kind]), [[game.code, "player"]]);
  assert.deepEqual(await call(db, randomUUID(), "dc_my_rooms", []), []);
});

test("preparação não vaza conteúdo de maleta no estado de ninguém", async () => {
  const game = await createGame(db, 4);
  await startMatch(game, 2);
  await toPreparation(game);
  for (const user of [game.moderator, ...game.players.map((p) => p.user)]) {
    const snapshot = await game.snapshot(user);
    assert.ok(snapshot.cases.every((c) => c.kind === null && c.amount === null));
    assert.equal(snapshot.settlement, null);
    assert.deepEqual(await call(db, user, "dc_my_spies", [game.roomId]), []);
  }
});

test("entradas fecham na divisão e quem chega depois aguarda uma decisão explícita", async () => {
  const game = await createGame(db, 5);
  await formTeams(game, 2);
  const closed = await game.join("Atrasada");
  assert.equal(closed.result.error, "entries_closed");
  await game.mod("set_entries", { open: true });
  const late = await game.join("Atrasada");
  assert.equal(late.result.ok, true);
  const waiting = (await game.snapshot(late.user)).me;
  assert.equal(waiting.teamId, null, "não entra em equipe automaticamente");
  const sizes = async () => {
    const { members, teams } = await game.snapshot();
    return teams.map((t) => members.filter((m) => m.teamId === t.id).length);
  };
  const before = await sizes();
  assert.deepEqual([...before].sort(), [2, 3]);
  const { teams } = await game.snapshot();
  const bigger = teams[before.indexOf(3)].id;
  await rejects(game.mod("assign_member", { memberId: waiting.memberId, teamId: bigger }), "unbalanced_team");
  await game.mod("assign_member", { memberId: waiting.memberId, teamId: teams[before.indexOf(2)].id });
  assert.deepEqual(await sizes(), [3, 3]);
  await rejects(game.mod("remove_member", { memberId: waiting.memberId }), "member_in_team");
});
