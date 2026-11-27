"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { GameError } from "@/lib/room/errors";
import { cleanCode, roomPath } from "@/lib/room/links";
import { deletingHere, justDeleted } from "@/lib/room/memory";
import { useRoom, type Room } from "@/lib/room/useRoom";
import type { MemberKind, Snapshot } from "@/lib/room/types";
import { isConfigured } from "@/lib/supabase/client";

export function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="safe-x mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 py-8 text-center">
      <h1 className="gold-text text-3xl leading-tight">{title}</h1>
      {children}
      <Link href="/" className="btn btn-ghost">
        Voltar ao início
      </Link>
    </main>
  );
}

export function NotConfigured() {
  return (
    <Notice title="Servidor não configurado">
      <p role="alert">{new GameError("not_configured").message}</p>
      <p className="text-sm text-cream/80">
        Quem publica o site precisa informar o projeto Supabase (veja o README).
      </p>
    </Notice>
  );
}

/**
 * Sala que não existe mais. Quem estava nela fica sabendo que o moderador a
 * apagou; um convite antigo aberto por outra pessoa só diz que ela acabou.
 */
export function RoomGone({ code, wasInside }: { code: string; wasInside: boolean }) {
  return (
    <Notice title={wasInside ? "Esta sala foi apagada pelo moderador" : "Sala não encontrada ou encerrada"}>
      <p role="status">
        {wasInside ? (
          <>
            A partida da sala <strong>{code}</strong> e os dados dela foram removidos. Seu mascote continua salvo neste
            aparelho.
          </>
        ) : (
          <>
            O código <strong>{code}</strong> não leva a nenhuma partida aberta.
          </>
        )}
      </p>
    </Notice>
  );
}

/** Quem apagou a sala neste aparelho segue para a lista, com a confirmação. */
function Deleted({ code, wasInside }: { code: string; wasInside: boolean }) {
  const router = useRouter();
  const mine = deletingHere.has(code);

  useEffect(() => {
    if (!mine) return;
    // O próprio banco já disse que a sala foi apagada: é a confirmação.
    justDeleted.code = code;
    router.replace("/salas/");
  }, [mine, code, router]);

  if (mine) {
    return (
      <p role="status" className="grid min-h-svh place-items-center font-bold">
        Apagando a sala…
      </p>
    );
  }
  return <RoomGone code={code} wasInside={wasInside} />;
}

type CodeRender = (code: string) => React.ReactNode;

// Fora da renderização do pai: assim a sala não é remontada a cada atualização.
function CodeReader({ render }: { render: CodeRender }) {
  return render(cleanCode(useSearchParams().get("sala")));
}

/** Lê o código da sala da query string (compatível com páginas estáticas e acesso direto). */
export function WithRoomCode({ children }: { children: CodeRender }) {
  return (
    <Suspense fallback={<p className="p-8 text-center font-bold">Carregando…</p>}>
      <CodeReader render={children} />
    </Suspense>
  );
}

type Ready = Room & { snapshot: Snapshot };

/**
 * Carrega a sala e entrega ao papel certo. O papel vem do BANCO: abrir outra
 * rota ou mudar o endereço não muda o que a pessoa pode fazer.
 */
export function RoomGate({
  code,
  allow,
  notMember,
  children,
}: {
  code: string;
  allow: MemberKind[];
  notMember?: (room: Room) => React.ReactNode;
  children: (room: Ready) => React.ReactNode;
}) {
  if (!isConfigured) return <NotConfigured />;
  if (!code) {
    return (
      <Notice title="Falta o código da sala">
        <Link href="/entrar/" className="btn btn-primary">
          Informar o código
        </Link>
      </Notice>
    );
  }
  return (
    <Loaded key={code} code={code} allow={allow} notMember={notMember}>
      {children}
    </Loaded>
  );
}

function Loaded({
  code,
  allow,
  notMember,
  children,
}: Parameters<typeof RoomGate>[0]) {
  const room = useRoom(code);
  const router = useRouter();
  const kind = room.snapshot?.me.kind;
  // Quem tem outro papel é levado à própria tela (o telão aceita qualquer integrante).
  const redirect = kind && !allow.includes(kind) ? roomPath(kind, code) : null;

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (room.phase === "deleted") return <Deleted code={code} wasInside={room.wasInside} />;
  if (room.phase === "not_member") {
    return (
      notMember?.(room) ?? (
        <Notice title="Você não está nesta sala">
          <p>
            A sala <strong>{code}</strong> não existe ou este aparelho ainda não entrou nela.
          </p>
          <Link href={`/entrar/?sala=${code}`} className="btn btn-primary">
            Entrar na sala
          </Link>
        </Notice>
      )
    );
  }
  if (room.phase === "failed") {
    return (
      <Notice title="Não foi possível abrir a sala">
        <p role="alert">{room.problem}</p>
        <button type="button" className="btn btn-primary" onClick={() => void room.refresh()}>
          Tentar de novo
        </button>
      </Notice>
    );
  }
  if (!room.snapshot || redirect) {
    return (
      <p role="status" className="grid min-h-svh place-items-center font-bold">
        Abrindo a sala…
      </p>
    );
  }
  return children(room as Ready);
}
