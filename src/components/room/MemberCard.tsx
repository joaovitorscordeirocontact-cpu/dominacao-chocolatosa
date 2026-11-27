import { Avatar } from "@/components/mascot/Avatar";
import { FitName } from "@/components/ui/FitName";
import { memberName } from "@/lib/room/model";
import type { Member } from "@/lib/room/types";

/** Marcador de batalhas já disputadas, acima do avatar. */
export function BattleBadge({ count }: { count: number }) {
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
      <span className="sr-only">{count === 1 ? " batalha disputada" : " batalhas disputadas"}</span>
    </span>
  );
}

/** Cartão de uma pessoa. Com `onSelect`, vira um botão de escolha. */
export function MemberCard({
  member,
  note = "",
  showBattles = false,
  selected = false,
  disabled = false,
  onSelect,
}: {
  member: Member;
  note?: string;
  showBattles?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const content = (
    <>
      {showBattles && <BattleBadge count={member.battles} />}
      <Avatar look={member.look} className={`size-18 sm:size-20 ${selected ? "ring-4 ring-pink" : ""}`} />
      <FitName className="mt-1 text-sm leading-tight font-extrabold">{memberName(member)}</FitName>
      <span className="min-h-4 text-[0.68rem] leading-4 font-bold text-blush">{note}</span>
    </>
  );
  const base = "flex h-full w-full min-w-0 flex-col items-center rounded-2xl border-2 px-1 pt-2 pb-2";
  return onSelect ? (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`${base} cursor-pointer transition-transform active:scale-95 disabled:cursor-default ${
        selected ? "border-gold bg-gold/20" : "border-transparent bg-cream/6"
      }`}
    >
      {content}
    </button>
  ) : (
    <div className={`${base} ${selected ? "border-gold bg-gold/20" : "border-transparent bg-cream/6"}`}>{content}</div>
  );
}
