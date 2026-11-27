import type { Metadata } from "next";
import { Lobby } from "@/components/lobby/Lobby";
import { Screen } from "@/components/ui/Screen";

export const metadata: Metadata = { title: "Lobby da fábrica · Dominação Chocolatosa" };

export default function LobbyPage() {
  return (
    <Screen title="Lobby da fábrica" eyebrow="Passo 3 de 4" backHref="/fabrica" backLabel="Fábrica">
      <Lobby />
    </Screen>
  );
}
