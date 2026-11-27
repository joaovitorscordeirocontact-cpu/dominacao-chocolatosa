/**
 * Sincronização de uma sala, sem React nem Supabase (testável).
 *
 * O estado vem sempre do banco. Os avisos do Realtime só dizem "há uma revisão
 * nova"; revisões antigas ou repetidas são ignoradas, e vários avisos durante
 * uma busca viram uma única busca seguinte. Enquanto o canal não está ativo,
 * há consulta periódica; com ele ativo, uma conferência mais espaçada.
 *
 * Uma sala apagada é um estado final: o código não é reaproveitado, então a
 * sincronização para de consultar e ignora o que ainda chegar do canal.
 */
import { toGameError } from "./errors.ts";
import type { RoomGone, Snapshot, SnapshotResult } from "./types.ts";

export type Connection = "connecting" | "live" | "reconnecting";

export type RoomView = {
  phase: "loading" | "ready" | "not_member" | "deleted" | "failed";
  snapshot: Snapshot | null;
  /** Na fase "deleted": este aparelho fazia parte da sala. */
  wasInside: boolean;
  connection: Connection;
  /** Mensagem do último erro de leitura (o estado anterior é mantido). */
  problem: string | null;
};

export type SyncOptions = {
  fetch: () => Promise<SnapshotResult>;
  livePollMs?: number;
  offlinePollMs?: number;
};

/**
 * Lê a sala. Quando o banco diz "não é integrante", confere se ela foi apagada:
 * é assim que um aparelho que perdeu o aviso (ou estava desligado) descobre.
 * Falha de rede em qualquer das consultas é propagada: nunca vira "apagada" nem
 * "não é sua" por engano.
 */
export async function readRoom(source: {
  hasSession: () => Promise<boolean>;
  snapshot: () => Promise<SnapshotResult>;
  gone: () => Promise<RoomGone>;
}): Promise<SnapshotResult> {
  const result: SnapshotResult = (await source.hasSession())
    ? await source.snapshot()
    : { ok: false, error: "not_member" };
  if (result.ok) return result;
  const { gone, wasMember } = await source.gone();
  return gone ? { ok: false, error: "room_deleted", wasMember } : result;
}

export function createRoomSync({ fetch, livePollMs = 25_000, offlinePollMs = 4_000 }: SyncOptions) {
  let view: RoomView = {
    phase: "loading", snapshot: null, wasInside: false, connection: "connecting", problem: null,
  };
  const listeners = new Set<() => void>();
  let inFlight: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let announced = 0;

  function set(change: Partial<RoomView>) {
    const next = { ...view, ...change };
    if ((Object.keys(next) as (keyof RoomView)[]).every((key) => next[key] === view[key])) return;
    view = next;
    listeners.forEach((listener) => listener());
  }

  const finished = () => view.phase === "deleted";

  function apply(result: SnapshotResult) {
    if (!result.ok && result.error === "room_deleted") {
      const wasInside = view.snapshot !== null || result.wasMember === true;
      set({ phase: "deleted", snapshot: null, wasInside, connection: "connecting", problem: null });
      return;
    }
    if (!result.ok) {
      set({ phase: "not_member", snapshot: null, problem: null });
      return;
    }
    const current = view.snapshot;
    // Uma resposta atrasada nunca substitui um estado mais novo.
    if (current && result.room.id === current.room.id && result.room.revision < current.room.revision) return;
    const unchanged =
      current !== null &&
      result.room.id === current.room.id &&
      result.room.revision === current.room.revision &&
      JSON.stringify(result) === JSON.stringify(current);
    set({ phase: "ready", snapshot: unchanged ? current : result, problem: null });
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    if (stopped || finished()) return;
    timer = setTimeout(() => void refresh(), view.connection === "live" ? livePollMs : offlinePollMs);
  }

  function refresh(): Promise<void> {
    if (stopped || finished()) return Promise.resolve();
    if (inFlight) {
      again = true;
      return inFlight;
    }
    inFlight = (async () => {
      do {
        again = false;
        try {
          apply(await fetch());
        } catch (error) {
          const { message } = toGameError(error);
          set(view.snapshot ? { problem: message, connection: "reconnecting" } : { phase: "failed", problem: message });
          break;
        }
      } while (again && !stopped && !finished());
    })().finally(() => {
      inFlight = null;
      schedule();
    });
    return inFlight;
  }

  return {
    refresh,
    getView: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Aviso do Realtime: busca apenas se a revisão anunciada ainda não chegou. */
    notify(revision: unknown) {
      if (typeof revision !== "number" || revision <= announced) return;
      announced = revision;
      if (!view.snapshot || revision > view.snapshot.room.revision) void refresh();
    },
    /** Canal ativo/inativo. Ao (re)assinar, busca o que possa ter sido perdido. */
    setLive(live: boolean) {
      if (finished()) return;
      const wasLive = view.connection === "live";
      set({ connection: live ? "live" : "reconnecting" });
      if (live && !wasLive) void refresh();
      else if (!live) schedule();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
    resume() {
      stopped = false;
    },
  };
}

export type RoomSync = ReturnType<typeof createRoomSync>;
