"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getSupabase, isConfigured, storedUserId } from "../supabase/client";
import { api } from "./api";
import { keepChannelAlive } from "./channel";
import { createRoomSync, type RoomView } from "./sync";

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
      fetch: async () => ((await storedUserId()) ? api.snapshot(code) : { ok: false, error: "not_member" }),
    }),
  );
  const view = useSyncExternalStore(sync.subscribe, sync.getView, sync.getView);
  const online = useOnline();
  const roomId = view.snapshot?.room.id;

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
    return () => {
      removal = keeper.stop();
    };
  }, [roomId, sync]);

  return { ...view, online, refresh: sync.refresh };
}
