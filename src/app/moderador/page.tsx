import type { Metadata } from "next";
import { PerspectiveSwitcher } from "@/components/demo/PerspectiveSwitcher";
import { ModeratorPanel } from "@/components/moderator/ModeratorPanel";
import { Screen } from "@/components/ui/Screen";

export const metadata: Metadata = { title: "Moderação · Dominação Chocolatosa" };

export default function ModeradorPage() {
  return (
    <Screen title="Moderação" eyebrow="Demonstração local" backHref="/" backLabel="Início" wide action={<PerspectiveSwitcher />}>
      <ModeratorPanel />
    </Screen>
  );
}
