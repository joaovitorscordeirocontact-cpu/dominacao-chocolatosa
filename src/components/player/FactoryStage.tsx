"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FactoryPicker } from "@/components/factory/FactoryPicker";
import { api } from "@/lib/room/api";
import { newId } from "@/lib/id";
import type { TeamView } from "@/lib/room/model";
import type { Commands } from "@/lib/room/useCommand";
import type { FactoryIdentity } from "@/lib/types";

/**
 * A liderança monta a fábrica. Cada mudança é enviada como rascunho para os
 * colegas acompanharem; "Confirmar" marca a fábrica como pronta.
 */
export function CaptainFactory({
  roomId,
  team,
  commands,
  refresh,
}: {
  roomId: string;
  team: TeamView;
  commands: Commands;
  refresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<FactoryIdentity>({
    name: team.name,
    model: team.model,
    background: team.background,
  });
  const [dirty, setDirty] = useState(false);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const change = useCallback((next: FactoryIdentity) => {
    setDraft(next);
    setDirty(true);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    timer.current = setTimeout(() => {
      saving.current = saving.current
        .then(() => api.command(roomId, newId(), "set_factory", { ...draft, ready: false }))
        .then(() => refresh())
        // O rascunho é só para os colegas verem: a confirmação reenvia tudo.
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer.current);
  }, [draft, dirty, roomId, refresh]);

  const confirmed = team.ready && !dirty;
  const named = draft.name.trim().length > 0;

  async function confirm() {
    clearTimeout(timer.current);
    await saving.current;
    if (await commands.run("set_factory", { ...draft, ready: true })) setDirty(false);
  }

  return (
    <FactoryPicker
      draft={draft}
      captainName={team.captain?.name ?? ""}
      onChange={change}
      footer={
        <>
          <p role="status" className="rounded-2xl bg-espresso/95 px-3 py-1 text-sm font-bold">
            {confirmed
              ? "✓ Fábrica confirmada. Dá para mudar até a partida começar."
              : "Sua equipe está vendo suas escolhas. Confirmem juntos."}
          </p>
          <button
            type="button"
            className="btn btn-primary text-lg"
            disabled={!named || confirmed || commands.pending !== null}
            onClick={() => void confirm()}
          >
            {confirmed ? "Fábrica confirmada" : "Confirmar fábrica"}
          </button>
        </>
      }
    />
  );
}
