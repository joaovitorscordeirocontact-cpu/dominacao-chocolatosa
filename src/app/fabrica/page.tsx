import type { Metadata } from "next";
import { FactoryEditor } from "@/components/factory/FactoryEditor";
import { Screen } from "@/components/ui/Screen";

export const metadata: Metadata = { title: "Sua fábrica · Dominação Chocolatosa" };

export default function FabricaPage() {
  return (
    <Screen title="Sua fábrica" eyebrow="Passo 2 de 4" backHref="/personagem">
      <FactoryEditor />
    </Screen>
  );
}
