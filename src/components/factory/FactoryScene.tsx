/* eslint-disable @next/next/no-img-element */
import type { FactoryIdentity } from "@/lib/types";

/** Combina fundo e modelo de fábrica (escolhas independentes). */
export function FactoryScene({
  factory,
  className = "aspect-4/3",
}: {
  factory: Pick<FactoryIdentity, "model" | "background">;
  className?: string;
}) {
  return (
    <div className={`fundo-${factory.background} relative overflow-hidden ${className}`}>
      <span
        aria-hidden="true"
        className="absolute inset-x-[14%] bottom-[3%] h-[9%] rounded-[50%] bg-black/45 blur-md"
      />
      <img
        key={factory.model}
        src={`/assets/fabricas/${factory.model}.webp`}
        alt=""
        draggable={false}
        className="factory-pop absolute inset-x-0 bottom-[6%] mx-auto h-[86%] w-[92%] object-contain object-bottom"
      />
    </div>
  );
}
