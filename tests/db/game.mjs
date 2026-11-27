// Auxiliares para conduzir uma partida pelas mesmas funções que o aplicativo usa.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runAs } from "./database.mjs";

export async function call(db, user, fn, params) {
  const marks = params.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await runAs(db.pool, user, `select public.${fn}(${marks}) as r`, params);
  return rows[0].r;
}

/** Espera o erro de regra `dc:<code>` e devolve o detalhe. */
export async function rejects(promise, code) {
  try {
    await promise;
  } catch (error) {
    assert.equal(error.message, `dc:${code}`, `esperava dc:${code}, veio ${error.message}`);
    return error.detail;
  }
  assert.fail(`esperava dc:${code}, mas a ação foi aceita`);
}

export async function createGame(db, playerCount = 8) {
  const moderator = randomUUID();
  const created = await call(db, moderator, "dc_create_room", [randomUUID()]);
  const game = { db, moderator, roomId: created.roomId, code: created.code, players: [] };

  game.command = (user, type, args = {}, commandId = randomUUID()) =>
    call(db, user, "dc_command", [game.roomId, commandId, type, JSON.stringify(args)]);
  game.mod = (type, args, commandId) => game.command(moderator, type, args, commandId);
  game.snapshot = (user = moderator) => call(db, user, "dc_snapshot", [game.code]);
  game.admin = async (sql, params = []) => (await db.pool.query(sql, params)).rows;

  game.join = async (name, as = "player") => {
    const user = randomUUID();
    const result = await call(db, user, "dc_join_room", [game.code, as, name, JSON.stringify({ color: "azul" })]);
    return { user, result };
  };

  for (let i = 1; i <= playerCount; i += 1) {
    const { user, result } = await game.join(`Pessoa ${i}`);
    assert.equal(result.ok, true);
    const snapshot = await game.snapshot(user);
    game.players.push({ user, id: snapshot.me.memberId, name: `Pessoa ${i}` });
  }
  return game;
}

/** Forma as equipes (capitães = primeiras pessoas) e indexa quem é quem. */
export async function formTeams(game, teamCount) {
  await game.mod("form_teams", { captainIds: game.players.slice(0, teamCount).map((p) => p.id) });
  await indexTeams(game);
}

export async function indexTeams(game) {
  const { teams, members } = await game.snapshot();
  game.teams = teams.map((team) => {
    const inTeam = members.filter((m) => m.teamId === team.id);
    const captain = inTeam.find((m) => m.isCaptain);
    return {
      id: team.id,
      slot: team.slot,
      captain: game.players.find((p) => p.id === captain.id),
      members: inTeam.map((m) => game.players.find((p) => p.id === m.id)),
    };
  });
}

export async function readyFactories(game) {
  for (const team of game.teams) {
    await game.command(team.captain.user, "set_factory", {
      name: `Fábrica ${team.slot}`, model: "castelo", background: "festa-uva", ready: true,
    });
  }
}

export async function startMatch(game, teamCount, total = 400, initial = 10) {
  await formTeams(game, teamCount);
  await readyFactories(game);
  await game.mod("set_economy", { total, initialPerTeam: initial });
  await game.mod("start_match");
}

/** Leva a rodada das indicações até a preparação, na ordem das equipes. */
export async function toPreparation(game, order = game.teams.map((t) => t.id)) {
  for (const team of game.teams) {
    await game.command(team.captain.user, "select_representative", { memberId: team.members.at(-1).id });
  }
  await game.mod("start_battle");
  await game.mod("record_battle", { ranking: order, playOrder: order });
}

export const teamOf = (game, id) => game.teams.find((t) => t.id === id);

/** Cada capitão escolhe, na ordem; `numbers[i]` é a maleta da i-ésima equipe da ordem. */
export async function pickAll(game, numbers) {
  await game.mod("close_preparation", { force: true });
  const snapshot = await game.snapshot();
  const order = [...snapshot.roundTeams].sort((a, b) => a.playPosition - b.playPosition);
  const free = snapshot.cases.filter((c) => c.state === "available").map((c) => c.number);
  for (const [index, row] of order.entries()) {
    const number = numbers?.[index] ?? free[index];
    await game.command(teamOf(game, row.teamId).captain.user, "pick_case", { number });
  }
}

export const byTeam = (rows) => Object.fromEntries(rows.map((row) => [row.teamId, row]));

export async function finishRound(game) {
  await game.mod("open_review");
  await game.mod("confirm_payment");
}

export async function assertConservation(game) {
  const { room, teams } = await game.snapshot();
  assert.equal(room.bank + teams.reduce((sum, t) => sum + t.balance, 0), room.totalChocolates);
}
