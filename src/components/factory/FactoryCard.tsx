import { FitName } from "@/components/ui/FitName";
import type { FactoryIdentity } from "@/lib/types";
import { FactoryScene } from "./FactoryScene";

/** Identidade da fábrica: nome da FÁBRICA em destaque e, abaixo, o da pessoa que lidera. */
export function FactoryCard({
  factory,
  captainName,
  placeholder = "Fábrica sem nome",
  sceneClassName = "aspect-16/10",
  children,
}: {
  factory: FactoryIdentity;
  captainName: string;
  placeholder?: string;
  sceneClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <figure className="overflow-hidden rounded-3xl border-2 border-gold/70 bg-chocolate shadow-panel">
      <FactoryScene factory={factory} className={sceneClassName} />
      <figcaption className="border-t-2 border-gold/70 px-3 py-3 text-center">
        <strong className="gold-text block font-normal">
          <FitName className="text-2xl leading-tight" min={17}>
            {factory.name || placeholder}
          </FitName>
        </strong>
        <span className="mt-1 block text-[0.68rem] font-black tracking-[0.18em] text-blush uppercase">Capitão</span>
        <FitName className="text-base leading-tight font-bold">{captainName || "—"}</FitName>
        {children}
      </figcaption>
    </figure>
  );
}
