"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { newId } from "@/lib/id";
import { api, type MyRoom } from "@/lib/room/api";
import { GameError, toGameError } from "@/lib/room/errors";
import { roomPath } from "@/lib/room/links";
import { ensureSession, isConfigured, storedUserId } from "@/lib/supabase/client";
import styles from "./opening.module.css";

/** Mantido até a sala ser criada: repetir o toque ou recarregar não cria duas. */
const PENDING_KEY = "dominacao-chocolatosa:criando-sala";

export function HomeActions() {
  const router = useRouter();
  const [resume, setResume] = useState<MyRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  // "Continuar partida" só aparece se este aparelho já tiver sessão: visitar a
  // abertura nunca cria usuário.
  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    (async () => {
      if (!(await storedUserId())) return;
      const open = (await api.myRooms()).find((room) => room.status !== "ended");
      if (alive) setResume(open ?? null);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function createRoom() {
    setProblem("");
    if (!isConfigured) return setProblem(new GameError("not_configured").message);
    setBusy(true);
    try {
      await ensureSession();
      let commandId = sessionStorage.getItem(PENDING_KEY);
      if (!commandId) sessionStorage.setItem(PENDING_KEY, (commandId = newId()));
      const created = await api.createRoom(commandId);
      sessionStorage.removeItem(PENDING_KEY);
      router.push(roomPath("moderator", created.code));
    } catch (error) {
      const failure = toGameError(error);
      if (failure.code !== "network") sessionStorage.removeItem(PENDING_KEY);
      setProblem(failure.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.actions}>
        {resume && (
          <Link href={roomPath(resume.kind, resume.code)} className={`btn btn-gold ${styles.action}`}>
            Continuar partida · {resume.code}
          </Link>
        )}
        <button type="button" className={`btn btn-primary ${styles.action}`} disabled={busy} onClick={() => void createRoom()}>
          {busy ? "Criando a sala…" : "Criar sala"}
        </button>
        <Link href="/entrar/" className={`btn btn-ghost ${styles.action} ${styles.secondary}`}>
          Entrar na sala
        </Link>
      </div>
      {problem && (
        <p role="alert" className={styles.problem}>
          {problem}
        </p>
      )}
    </>
  );
}
