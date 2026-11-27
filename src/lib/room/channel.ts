/**
 * Mantém UM canal de avisos assinado, sem React nem Supabase (testável).
 *
 * O cliente do Realtime já tenta reassinar sozinho. Esta é a reserva para quando
 * o canal não volta: depois de um tempo sem "SUBSCRIBED", descarta o canal e cria
 * outro. Cuidados que evitam um ciclo de derrubar um canal saudável:
 *  - o canal é marcado como descartado ANTES de ser removido (a remoção pode
 *    avisar "CLOSED" na mesma hora);
 *  - avisos de um canal que não é o atual são ignorados;
 *  - todo status novo cancela a tentativa que estava agendada.
 */
export type ChannelLike = { state: string };

export type KeepAliveOptions<C extends ChannelLike> = {
  /** Cria e assina um canal, repassando cada status. */
  open: (onStatus: (status: string) => void) => C;
  remove: (channel: C) => Promise<unknown>;
  onLive: (live: boolean) => void;
  /** Preparação antes de cada assinatura (aguardar remoções, atualizar o JWT). */
  prepare: () => Promise<unknown>;
  retryMs?: number;
};

export function keepChannelAlive<C extends ChannelLike>({
  open,
  remove,
  onLive,
  prepare,
  retryMs = 5_000,
}: KeepAliveOptions<C>) {
  let current: { channel: C | null } | null = null;
  let removal: Promise<unknown> = Promise.resolve();
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function drop() {
    const old = current;
    current = null; // primeiro descarta, depois remove
    if (old?.channel) removal = remove(old.channel);
  }

  async function connect() {
    // A preparação pode falhar sem rede; a tentativa seguinte cuida disso.
    try {
      await removal;
      await prepare();
    } catch {
      if (!stopped) schedule(null);
      return;
    }
    if (stopped || current) return;
    const slot: { channel: C | null } = { channel: null };
    current = slot;
    slot.channel = open((status) => {
      if (stopped || current !== slot) return;
      onLive(status === "SUBSCRIBED");
      clearTimeout(retry);
      if (status !== "SUBSCRIBED") schedule(slot);
    });
  }

  function schedule(slot: { channel: C | null } | null) {
    clearTimeout(retry);
    retry = setTimeout(() => {
      if (stopped || current !== slot || slot?.channel?.state === "joined") return;
      drop();
      void connect();
    }, retryMs);
  }

  void connect();

  return {
    /** Encerra e devolve a remoção pendente, para a próxima assinatura aguardar. */
    stop() {
      stopped = true;
      clearTimeout(retry);
      drop();
      return removal;
    },
  };
}
