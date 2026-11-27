"use client";

import { getSupabase } from "../supabase/client";
import type { MascotLook } from "../types";
import { toGameError } from "./errors";
import type { MemberKind, SnapshotResult, SpyRecord, SpyResult } from "./types";

const RETRY_DELAYS = [700, 1800];

/**
 * Todas as chamadas são idempotentes no banco (identificador de comando,
 * vínculo único ou autorização de uso único), então repetir após falha de rede
 * é seguro.
 */
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    let failure: unknown;
    try {
      const { data, error } = await getSupabase().rpc(name, args).abortSignal(AbortSignal.timeout(12_000));
      if (!error) return data as T;
      failure = error;
    } catch (error) {
      failure = error;
    }
    const gameError = toGameError(failure);
    if (gameError.code !== "network" || attempt >= RETRY_DELAYS.length) throw gameError;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
  }
}

export type JoinResult =
  | { ok: true; roomId: string; code: string; kind: MemberKind; existing: boolean }
  | { ok: false; error: string };

export type MyRoom = { roomId: string; code: string; status: string; kind: MemberKind; createdAt: string };

export const api = {
  createRoom: (commandId: string) =>
    rpc<{ roomId: string; code: string }>("dc_create_room", { p_command_id: commandId }),
  joinRoom: (code: string, as: "player" | "screen", name = "", look: Partial<MascotLook> = {}) =>
    rpc<JoinResult>("dc_join_room", { p_code: code, p_as: as, p_name: name, p_look: look }),
  command: (roomId: string, commandId: string, type: string, args: Record<string, unknown>) =>
    rpc<{ revision: number }>("dc_command", { p_room: roomId, p_command_id: commandId, p_type: type, p_args: args }),
  snapshot: (code: string) => rpc<SnapshotResult>("dc_snapshot", { p_code: code }),
  spy: (roomId: string, caseNumber: number) => rpc<SpyResult>("dc_spy", { p_room: roomId, p_number: caseNumber }),
  mySpies: (roomId: string) => rpc<SpyRecord[]>("dc_my_spies", { p_room: roomId }),
  myRooms: () => rpc<MyRoom[]>("dc_my_rooms", {}),
};
