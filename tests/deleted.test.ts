// Sala apagada vista pelo aparelho: reconhecimento, estado final e limpeza.
import assert from "node:assert/strict";
import { test } from "node:test";
import { casePositions, forgetRoom, openedCases } from "../src/lib/room/memory.ts";
import { createRoomSync, readRoom } from "../src/lib/room/sync.ts";
import type { RoomGone, Snapshot, SnapshotResult } from "../src/lib/room/types.ts";

const state = (revision: number) => ({ ok: true, room: { id: "sala", revision } }) as unknown as Snapshot;
const deleted = (wasMember: boolean): SnapshotResult => ({ ok: false, error: "room_deleted", wasMember });
const tick = () => new Promise((resolve) => setImmediate(resolve));

function source(session: boolean, snapshot: SnapshotResult, gone: RoomGone) {
  const calls: string[] = [];
  return {
    calls,
    read: () =>
      readRoom({
        hasSession: async () => session,
        snapshot: async () => (calls.push("snapshot"), snapshot),
        gone: async () => (calls.push("gone"), gone),
      }),
  };
}

test("só pergunta se a sala foi apagada quando não consegue abri-la", async () => {
  const open = source(true, state(1), { gone: false, wasMember: false });
  assert.equal((await open.read()).ok, true);
  assert.deepEqual(open.calls, ["snapshot"]);

  const stranger = source(true, { ok: false, error: "not_member" }, { gone: false, wasMember: false });
  assert.deepEqual(await stranger.read(), { ok: false, error: "not_member" });

  const former = source(true, { ok: false, error: "not_member" }, { gone: true, wasMember: true });
  assert.deepEqual(await former.read(), deleted(true));
});

test("convite antigo sem sessão é reconhecido sem consultar a sala", async () => {
  const visitor = source(false, state(1), { gone: true, wasMember: false });
  assert.deepEqual(await visitor.read(), deleted(false));
  assert.deepEqual(visitor.calls, ["gone"]);
});

test("falha de rede ao conferir não vira 'apagada' nem 'não é sua'", async () => {
  let answers: (() => Promise<SnapshotResult>)[] = [
    async () => state(2),
    () =>
      readRoom({
        hasSession: async () => true,
        snapshot: async () => ({ ok: false, error: "not_member" }),
        gone: async () => {
          throw new TypeError("Failed to fetch");
        },
      }),
  ];
  const sync = createRoomSync({ fetch: () => answers.shift()!(), livePollMs: 3_600_000, offlinePollMs: 3_600_000 });
  await sync.refresh();
  await sync.refresh();
  assert.equal(sync.getView().phase, "ready");
  assert.equal(sync.getView().snapshot!.room.revision, 2);
  assert.match(sync.getView().problem!, /Sem resposta/);
  answers = [];
  sync.stop();
});

test("sala apagada é estado final: some o estado, param as consultas e os avisos são ignorados", async () => {
  let calls = 0;
  const results: SnapshotResult[] = [state(3), deleted(false), state(9)];
  const sync = createRoomSync({
    fetch: async () => results[Math.min(calls++, results.length - 1)],
    livePollMs: 5,
    offlinePollMs: 5,
  });
  await sync.refresh();
  sync.setLive(true);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(calls, 2, "nenhuma consulta depois de saber que foi apagada");
  const view = sync.getView();
  assert.deepEqual([view.phase, view.snapshot, view.wasInside, view.problem], ["deleted", null, true, null]);

  sync.notify(50);
  sync.setLive(false);
  sync.setLive(true);
  await sync.refresh();
  sync.stop();
  sync.resume();
  await sync.refresh();
  await tick();
  assert.equal(calls, 2);
  assert.equal(sync.getView(), view);
});

test("quem reconecta depois sabe se fazia parte da sala", async () => {
  for (const wasMember of [true, false]) {
    const sync = createRoomSync({ fetch: async () => deleted(wasMember) });
    await sync.refresh();
    assert.deepEqual([sync.getView().phase, sync.getView().wasInside], ["deleted", wasMember]);
    sync.stop();
  }
});

test("esquecer uma sala não mexe nas lembranças das outras", () => {
  for (const key of ["a1-3", "espiada-a1-7", "b2-3", "espiada-b2-7"]) openedCases.add(key);
  casePositions.set("a1-3", "equipe");
  casePositions.set("b2-3", "equipe");
  forgetRoom("a1");
  assert.deepEqual([...openedCases], ["b2-3", "espiada-b2-7"]);
  assert.deepEqual([...casePositions.keys()], ["b2-3"]);
});
