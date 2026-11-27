"use client";

import { useState } from "react";
import { Notice } from "@/components/room/RoomGate";
import { api } from "@/lib/room/api";
import { GameError, toGameError } from "@/lib/room/errors";
import { ensureSession } from "@/lib/supabase/client";

/** Conectar um telão é uma ação explícita: só abrir o endereço não cria nada. */
export function OpenScreen({ code, onJoined }: { code: string; onJoined: () => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function connect() {
    setBusy(true);
    setProblem("");
    try {
      await ensureSession();
      const result = await api.joinRoom(code, "screen");
      if (!result.ok) throw new GameError(result.error);
      onJoined();
    } catch (error) {
      setProblem(toGameError(error).message);
      setBusy(false);
    }
  }

  return (
    <Notice title="Abrir o telão">
      <p>
        Este aparelho vai mostrar a sala <strong>{code}</strong> em modo somente leitura.
      </p>
      <button type="button" className="btn btn-primary text-lg" disabled={busy} onClick={() => void connect()}>
        {busy ? "Conectando…" : "Usar como telão"}
      </button>
      {problem && (
        <p role="alert" className="font-bold text-blush">
          {problem}
        </p>
      )}
    </Notice>
  );
}
