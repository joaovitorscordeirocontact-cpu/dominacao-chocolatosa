"use client";

import { JoinFlow } from "@/components/join/JoinFlow";
import { WithRoomCode } from "@/components/room/RoomGate";

export function JoinPage() {
  return <WithRoomCode>{(code) => <JoinFlow code={code} />}</WithRoomCode>;
}
