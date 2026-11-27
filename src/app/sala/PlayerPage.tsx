"use client";

import { PlayerView } from "@/components/player/PlayerView";
import { RoomGate, WithRoomCode } from "@/components/room/RoomGate";

export function PlayerPage() {
  return (
    <WithRoomCode>
      {(code) => (
        <RoomGate code={code} allow={["player"]}>
          {(room) => <PlayerView room={room} />}
        </RoomGate>
      )}
    </WithRoomCode>
  );
}
