"use client";

import { RoomGate, WithRoomCode } from "@/components/room/RoomGate";
import { OpenScreen } from "@/components/screen/OpenScreen";
import { ScreenView } from "@/components/screen/ScreenView";

export function ScreenPage() {
  return (
    <WithRoomCode>
      {(code) => (
        <RoomGate
          code={code}
          // Quem já é da sala (inclusive o moderador, em outra janela) vê a mesma visão pública.
          allow={["screen", "moderator", "player"]}
          notMember={(room) => <OpenScreen code={code} onJoined={() => void room.refresh()} />}
        >
          {(room) => <ScreenView room={room} />}
        </RoomGate>
      )}
    </WithRoomCode>
  );
}
