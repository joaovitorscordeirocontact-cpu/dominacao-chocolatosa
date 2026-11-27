"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSupabase, isConfigured, storedUserId } from "../supabase/client";
import { api } from "./api";
import { keepChannelAlive } from "./channel";
import { forgetRoom } from "./memory";
import { createRoomSync, readRoom, type RoomView } from "./sync";

/** `supabase.channel()` reaproveita nomes: só assina depois de a remoção anterior terminar. */
let removal: Promise<unknown> = Promise.resolve();

export type Room = RoomView & { online: boolean; refresh: () => Promise<void> };

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export const useOnline = () =>
  useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

/** Estado ao vivo de uma sala. Quem não tem sessão aparece como "não integrante". */
export function useRoom(code: string): Room {
  const [sync] = useState(() =>
    createRoomSync({
      fetch: () =>
        readRoom({
          hasSession: async () => (await storedUserId()) !== null,
          snapshot: () => api.snapshot(code),
          gone: () => api.roomGone(code),
        }),
    }),
  );
  const view = useSyncExternalStore(sync.subscribe, sync.getView, sync.getView);
  const online = useOnline();
  const roomId = view.snapshot?.room.id;
  const deleted = view.phase === "deleted";

  useEffect(() => {
    if (!isConfigured) return;
    sync.resume();
    void sync.refresh();
    const wake = () => {
      if (document.visibilityState === "visible") void sync.refresh();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      sync.stop();
    };
  }, [sync]);

  useEffect(() => {
    if (!roomId) return;
    const supabase = getSupabase();
    const keeper = keepChannelAlive<RealtimeChannel>({
      // Canal privado: o Realtime autoriza com o JWT atual contra o RLS.
      prepare: async () => {
        await removal;
        await supabase.realtime.setAuth();
      },
      open: (onStatus) =>
        supabase
          .channel(`dominacao:${roomId}`, { config: { private: true } })
          .on("broadcast", { event: "changed" }, (message) => sync.notify(message.payload?.revision))
          .subscribe(onStatus),
      remove: (channel) => supabase.removeChannel(channel),
      onLive: sync.setLive,
    });
    // Sala apagada ou perdida: `roomId` some e a assinatura é encerrada aqui.
    return () => {
      removal = keeper.stop();
    };
  }, [roomId, sync]);

  // Esquece o que este aparelho guardava em memória sobre a sala apagada.
  const lastRoomId = useRef<string | null>(null);
  useEffect(() => {
    if (roomId) lastRoomId.current = roomId;
    else if (deleted && lastRoomId.current) forgetRoom(lastRoomId.current);
  }, [roomId, deleted]);

  return { ...view, online, refresh: sync.refresh };
}
