"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CharacterEditor } from "@/components/character/CharacterEditor";
import { NotConfigured, RoomGone } from "@/components/room/RoomGate";
import { Screen } from "@/components/ui/Screen";
import { saveProfile, useHydrated, useProfile } from "@/lib/profile-store";
import { api } from "@/lib/room/api";
import { GameError, toGameError } from "@/lib/room/errors";
import { cleanCode, roomPath } from "@/lib/room/links";
import { readRoom } from "@/lib/room/sync";
import { ensureSession, isConfigured, storedUserId } from "@/lib/supabase/client";

function CodeForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const code = cleanCode(text);
  return (
    <Screen title="Entrar na sala" backHref="/" backLabel="Início">
      <form
        className="panel mx-auto mt-4 max-w-md p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (code) router.push(`/entrar/?sala=${code}`);
        }}
      >
        <label htmlFor="codigo" className="mb-2 block font-extrabold">
          Código da sala
        </label>
        <input
          id="codigo"
          className="field text-center font-display text-3xl! tracking-[0.3em] uppercase"
          value={text}
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABC234"
          onChange={(event) => setText(event.target.value.toUpperCase())}
        />
        <p className="mt-2 text-sm text-cream/80">São 6 letras e números. Se recebeu um link, é só abri-lo.</p>
        <button type="submit" className="btn btn-primary mt-4 w-full text-lg" disabled={!code}>
          Continuar
        </button>
      </form>
    </Screen>
  );
}

function JoinRoom({ code }: { code: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const profile = useProfile();
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [gone, setGone] = useState<{ wasInside: boolean } | null>(null);

  // Quem já faz parte da sala volta direto para ela, sem duplicar. Um convite
  // de sala apagada é avisado já na chegada, sem criar usuário.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const found = await readRoom({
          hasSession: async () => (await storedUserId()) !== null,
          snapshot: () => api.snapshot(code),
          gone: () => api.roomGone(code),
        });
        if (!alive) return;
        if (found.ok) return router.replace(roomPath(found.me.kind, code));
        if (found.error === "room_deleted") setGone({ wasInside: found.wasMember === true });
      } catch (error) {
        if (alive) setProblem(toGameError(error).message);
      }
      if (alive) setChecking(false);
    })();
    return () => {
      alive = false;
    };
  }, [code, router]);

  async function join() {
    setBusy(true);
    setProblem("");
    try {
      await ensureSession();
      const { name, ...look } = profile;
      const result = await api.joinRoom(code, "player", name.trim(), look);
      if (!result.ok && result.error === "room_not_found") return setGone({ wasInside: false });
      if (!result.ok) throw new GameError(result.error);
      saveProfile(profile);
      router.push(roomPath(result.kind, code));
    } catch (error) {
      setProblem(toGameError(error).message);
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <p role="status" className="grid min-h-svh place-items-center font-bold">
        Abrindo o convite…
      </p>
    );
  }

  if (gone) return <RoomGone code={code} wasInside={gone.wasInside} />;

  return (
    <Screen title="Seu mascote" eyebrow={`Sala ${code}`} backHref="/" backLabel="Início">
      <CharacterEditor
        profile={profile}
        onChange={saveProfile}
        disabled={!hydrated}
        footer={
          <>
            {problem && (
              <p role="alert" className="rounded-2xl border border-[#ff9d9d] bg-[#4a1214] px-3 py-2 text-sm font-bold">
                {problem}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary text-lg"
              disabled={busy || !profile.name.trim()}
              onClick={() => void join()}
            >
              {busy ? "Entrando…" : "Entrar na sala"}
            </button>
            {!profile.name.trim() && hydrated && <p className="text-sm font-bold text-blush">Escreva seu nome para entrar.</p>}
            <Link href={`/telao/?sala=${code}`} className="text-sm font-bold text-blush underline underline-offset-4">
              Este aparelho é o telão
            </Link>
          </>
        }
      />
    </Screen>
  );
}

export function JoinFlow({ code }: { code: string }) {
  if (!isConfigured) return <NotConfigured />;
  return code ? <JoinRoom key={code} code={code} /> : <CodeForm />;
}
