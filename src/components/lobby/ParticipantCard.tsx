import { Avatar } from "@/components/mascot/Avatar";
import type { Participant } from "@/lib/types";

/** Marcador de participações acima do avatar circular. */
export function ParticipationBadge({ count }: { count: number }) {
  return (
    <span
      key={count}
      className="badge-pop relative z-10 -mb-2 inline-flex min-w-11 items-center justify-center gap-1 rounded-full border-2 border-espresso bg-gold px-2 text-sm font-black text-espresso tabular-nums"
    >
      <svg viewBox="0 0 12 16" className="h-3.5 w-2.5" aria-hidden="true">
        <rect x="1" y="1" width="10" height="14" rx="2" fill="#c50f66" stroke="#3a1d06" strokeWidth="1.5" />
        <path d="M6 5 8.4 8 6 11 3.6 8Z" fill="#fff0dd" />
      </svg>
      {count}
      <span className="sr-only">{count === 1 ? " participação" : " participações"} na batalha pelas cartas</span>
    </span>
  );
}

export function ParticipantCard({
  participant,
  count,
  selected,
  confirmed,
  disabled,
  isYou,
  onSelect,
}: {
  participant: Participant;
  count: number;
  selected: boolean;
  confirmed: boolean;
  disabled: boolean;
  isYou: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex min-w-0 cursor-pointer flex-col items-center rounded-2xl border-2 px-1 pt-2 pb-2 transition-transform active:scale-95 disabled:cursor-default ${
        selected ? "border-gold bg-gold/20" : "border-transparent bg-cream/6"
      }`}
    >
      <ParticipationBadge count={count} />
      <Avatar
        look={participant}
        className={`size-18 sm:size-20 ${selected ? "ring-4 ring-pink" : ""}`}
      />
      <span className="mt-1 w-full truncate text-sm font-extrabold">{participant.name}</span>
      <span className="min-h-4 text-[0.68rem] leading-4 font-bold text-blush">
        {selected
          ? confirmed
            ? "✓ Confirmado"
            : "Selecionado"
          : participant.isCaptain
            ? isYou
              ? "Capitão (você)"
              : "Capitão"
            : ""}
      </span>
    </button>
  );
}
