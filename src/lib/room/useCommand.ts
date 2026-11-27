"use client";

import { useCallback, useRef, useState } from "react";
import { newId } from "../id";
import { api } from "./api";
import { GameError, toGameError } from "./errors";

/**
 * Envia comandos de uma sala. Nada é mostrado como concluído antes da resposta
 * do banco: a tela só muda quando o novo estado chega.
 *
 * Se a rede falhar, repetir a MESMA ação reutiliza o identificador do comando;
 * caso a primeira tentativa tenha valido, ela não é aplicada de novo.
 */
export function useCommand(roomId: string, refresh: () => Promise<void>) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<GameError | null>(null);
  const busy = useRef(false);
  const unsent = useRef(new Map<string, string>());

  const run = useCallback(
    async (type: string, args: Record<string, unknown> = {}) => {
      if (busy.current) return false;
      busy.current = true;
      setPending(type);
      setError(null);
      const signature = `${type}:${JSON.stringify(args)}`;
      const commandId = unsent.current.get(signature) ?? newId();
      unsent.current.set(signature, commandId);
      try {
        await api.command(roomId, commandId, type, args);
        unsent.current.delete(signature);
        await refresh();
        return true;
      } catch (failure) {
        const gameError = toGameError(failure);
        // Só uma falha de rede deixa dúvida sobre o que o banco recebeu.
        if (gameError.code !== "network") {
          unsent.current.delete(signature);
          void refresh();
        }
        setError(gameError);
        return false;
      } finally {
        busy.current = false;
        setPending(null);
      }
    },
    [roomId, refresh],
  );

  return { run, pending, error, clearError: () => setError(null) };
}

export type Commands = ReturnType<typeof useCommand>;
