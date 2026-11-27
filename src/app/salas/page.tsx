import type { Metadata } from "next";
import { OwnedRooms } from "@/components/moderator/OwnedRooms";

export const metadata: Metadata = { title: "Minhas salas · Dominação Chocolatosa" };

export default function Page() {
  return <OwnedRooms />;
}
