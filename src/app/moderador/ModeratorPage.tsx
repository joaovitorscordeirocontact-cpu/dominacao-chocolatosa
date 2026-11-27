"use client";

import { ModeratorView } from "@/components/moderator/ModeratorView";
import { RoomGate, WithRoomCode } from "@/components/room/RoomGate";

/** Abrir este endereço não dá moderação: o papel vem do banco. */
export function ModeratorPage() {
  return (
    <WithRoomCode>
      {(code) => (
        <RoomGate code={code} allow={["moderator"]}>
          {(room) => <ModeratorView room={room} />}
        </RoomGate>
      )}
    </WithRoomCode>
  );
}
