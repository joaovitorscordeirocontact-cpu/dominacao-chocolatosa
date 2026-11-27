// Sincronização da sala: revisões, avisos repetidos, reconexão e falhas.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRoomSync } from "../src/lib/room/sync.ts";
import type { Snapshot, SnapshotResult } from "../src/lib/room/types.ts";

const state = (revision: number, id = "sala") => ({ ok: true, room: { id, revision } }) as unknown as Snapshot;

/** Servidor falso em que cada resposta é liberada manualmente. */
function manualServer() {
  const waiting: { resolve: (r: SnapshotResult) => void; reject: (e: unknown) => void }[] = [];
  let calls = 0;
  return {
    fetch: () => new Promise<SnapshotResult>((resolve, reject) => { calls += 1; waiting.push({ resolve, reject }); }),
    calls: () => calls,
    async answer(result: SnapshotResult) { waiting.shift()!.resolve(result); await tick(); },
    async break_(error: unknown) { waiting.shift()!.reject(error); await tick(); },
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
const slow = { livePollMs: 3_600_000, offlinePollMs: 3_600_000 };

test("resposta atrasada ou aviso antigo não voltam o estado", async () => {
  const server = manualServer();
  const sync = createRoomSync({ fetch: server.fetch, ...slow });
  void sync.refresh();
  await server.answer(state(5));
  sync.notify(5);
  sync.notify(3);
  assert.equal(server.calls(), 1, "aviso repetido ou antigo não busca nada");
  sync.notify(6);
  await server.answer(state(4));
  assert.equal(sync.getView().snapshot!.room.revision, 5, "revisão menor é descartada");
  sync.stop();
});

test("vários avisos durante uma busca viram uma única busca seguinte", async () => {
  const server = manualServer();
  const sync = createRoomSync({ fetch: server.fetch, ...slow });
  void sync.refresh();
  for (const revision of [2, 3, 4, 4]) sync.notify(revision);
  assert.equal(server.calls(), 1);
  await server.answer(state(1));
  assert.equal(server.calls(), 2);
  await server.answer(state(4));
  assert.equal(server.calls(), 2);
  assert.equal(sync.getView().snapshot!.room.revision, 4);
  sync.stop();
});

test("estado idêntico mantém a mesma referência (não reanima a tela)", async () => {
  const server = manualServer();
  const sync = createRoomSync({ fetch: server.fetch, ...slow });
  void sync.refresh();
  await server.answer(state(2));
  const first = sync.getView();
  void sync.refresh();
  await server.answer(state(2));
  assert.equal(sync.getView(), first);
  sync.stop();
});

test("ao reassinar o canal, busca o estado persistido", async () => {
  const server = manualServer();
  const sync = createRoomSync({ fetch: server.fetch, ...slow });
  void sync.refresh();
  await server.answer(state(1));
  sync.setLive(true);
  assert.equal(server.calls(), 2);
  await server.answer(state(1));
  sync.setLive(false);
  assert.equal(sync.getView().connection, "reconnecting");
  sync.setLive(true);
  assert.equal(server.calls(), 3);
  await server.answer(state(9));
  assert.equal(sync.getView().snapshot!.room.revision, 9);
  sync.stop();
});

test("falha de rede mantém o último estado e avisa; sem estado, informa a falha", async () => {
  const server = manualServer();
  const sync = createRoomSync({ fetch: server.fetch, ...slow });
  void sync.refresh();
  await server.break_(new TypeError("Failed to fetch"));
  assert.equal(sync.getView().phase, "failed");
  assert.equal(sync.getView().snapshot, null, "nunca inventa dados");
  void sync.refresh();
  await server.answer(state(3));
  void sync.refresh();
  await server.break_(new TypeError("Failed to fetch"));
  assert.equal(sync.getView().phase, "ready");
  assert.equal(sync.getView().snapshot!.room.revision, 3);
  assert.match(sync.getView().problem!, /Sem resposta/);
  sync.stop();
});

test("sem canal ativo, consulta periodicamente", async () => {
  let calls = 0;
  const sync = createRoomSync({ fetch: async () => state(++calls), offlinePollMs: 5, livePollMs: 3_600_000 });
  void sync.refresh();
  await new Promise((resolve) => setTimeout(resolve, 60));
  sync.stop();
  assert.ok(calls >= 3, `consultas: ${calls}`);
});

test("quem deixa de ser integrante não fica com o estado antigo", async () => {
  const server = manualServer();
  const sync = createRoomSync({ fetch: server.fetch, ...slow });
  void sync.refresh();
  await server.answer(state(1));
  void sync.refresh();
  await server.answer({ ok: false, error: "not_member" });
  assert.deepEqual([sync.getView().phase, sync.getView().snapshot], ["not_member", null]);
  sync.stop();
});
