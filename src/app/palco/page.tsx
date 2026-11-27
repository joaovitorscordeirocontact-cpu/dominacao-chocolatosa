import type { Metadata } from "next";
import { PerspectiveSwitcher } from "@/components/demo/PerspectiveSwitcher";
import { StagePlayer } from "@/components/stage/StagePlayer";
import { Screen } from "@/components/ui/Screen";

export const metadata: Metadata = { title: "Palco das maletas · Dominação Chocolatosa" };

export default function PalcoPage() {
  return (
    <Screen title="Palco das maletas" eyebrow="Passo 4 de 4" backHref="/lobby" backLabel="Lobby" action={<PerspectiveSwitcher />}>
      <StagePlayer />
    </Screen>
  );
}
