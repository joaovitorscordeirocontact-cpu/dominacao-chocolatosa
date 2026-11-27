import type { Metadata } from "next";
import { CharacterEditor } from "@/components/character/CharacterEditor";
import { Screen } from "@/components/ui/Screen";

export const metadata: Metadata = { title: "Seu mascote · Dominação Chocolatosa" };

export default function PersonagemPage() {
  return (
    <Screen title="Seu mascote" eyebrow="Passo 1 de 4" backHref="/" backLabel="Início">
      <CharacterEditor />
    </Screen>
  );
}
