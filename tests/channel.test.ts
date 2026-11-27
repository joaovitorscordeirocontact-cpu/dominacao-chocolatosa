// Reconexão do canal: uma queda gera no máximo uma troca de canal, nunca um ciclo.
import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { keepChannelAlive } from "../src/lib/room/channel.ts";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Imita o cliente do Realtime: remover um canal avisa "CLOSED" na mesma hora. */
function fakeRealtime(t: TestContext) {
  const channels: { state: string; emit: (status: string) => void; removed: boolean }[] = [];
  const live: boolean[] = [];
  const keeper = keepChannelAlive({
    retryMs: 20,
    prepare: async () => {},
    open: (onStatus) => {
      const channel = {
        state: "joining",
        removed: false,
        emit(status: string) {
          this.state = status === "SUBSCRIBED" ? "joined" : "errored";
          onStatus(status);
        },
      };
      channels.push(channel);
      return channel;
    },
    remove: async (channel) => {
      const target = channel as (typeof channels)[number];
      target.removed = true;
      target.emit("CLOSED");
    },
    onLive: (value) => live.push(value),
  });
  // Encerra mesmo quando uma verificação falha: um ciclo não pode travar o teste.
  t.after(() => keeper.stop());
  return { keeper, channels, live };
}

test("canal que não volta é trocado uma única vez e o novo não é derrubado", async (t) => {
  const { keeper, channels, live } = fakeRealtime(t);
  await wait(5);
  channels[0].emit("SUBSCRIBED");
  channels[0].emit("CHANNEL_ERROR");
  await wait(35);
  assert.equal(channels.length, 2, "criou um canal substituto");
  assert.equal(channels[0].removed, true);
  channels[1].emit("SUBSCRIBED");
  await wait(150);
  assert.equal(channels.length, 2, "o canal saudável permanece");
  assert.equal(channels[1].removed, false);
  assert.equal(live.at(-1), true);
  await keeper.stop();
});

test("se o próprio cliente reassina a tempo, nada é recriado", async (t) => {
  const { keeper, channels, live } = fakeRealtime(t);
  await wait(5);
  channels[0].emit("CHANNEL_ERROR");
  channels[0].emit("TIMED_OUT");
  await wait(8);
  channels[0].emit("SUBSCRIBED");
  await wait(150);
  assert.equal(channels.length, 1);
  assert.equal(live.at(-1), true);
  await keeper.stop();
});

test("falha repetida tenta de novo, um canal por vez", async (t) => {
  const { keeper, channels } = fakeRealtime(t);
  await wait(5);
  for (let i = 0; i < 3; i += 1) {
    channels[i].emit("CHANNEL_ERROR");
    await wait(35);
    assert.equal(channels.length, i + 2);
    assert.equal(channels.filter((c) => !c.removed).length, 1);
  }
  await keeper.stop();
});

test("depois de parar, nada é reassinado nem notificado", async (t) => {
  const { keeper, channels, live } = fakeRealtime(t);
  await wait(5);
  channels[0].emit("CHANNEL_ERROR");
  const before = live.length;
  await keeper.stop();
  await wait(100);
  assert.equal(channels.length, 1);
  assert.equal(live.length, before);
});
