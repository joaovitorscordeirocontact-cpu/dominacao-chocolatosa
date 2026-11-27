import Link from "next/link";
import { ChocolateWave } from "./ChocolateWave";

/** Moldura das telas internas: onda no topo, navegação e área segura. */
export function Screen({
  title,
  eyebrow,
  backHref,
  backLabel = "Voltar",
  action,
  wide = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  backHref: string;
  backLabel?: string;
  action?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col">
      <ChocolateWave className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 w-full sm:h-32" />
      <header
        className={`safe-x mx-auto w-full pt-[max(0.75rem,env(safe-area-inset-top))] ${wide ? "max-w-7xl" : "max-w-5xl"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <Link href={backHref} className="btn btn-ghost min-h-11! px-4! py-1! text-sm">
            <span aria-hidden="true">←</span> {backLabel}
          </Link>
          {action}
        </div>
        <div className="mt-3 text-center">
          {eyebrow && <p className="text-xs font-extrabold tracking-[0.2em] text-blush uppercase">{eyebrow}</p>}
          <h1 className="gold-text text-[2rem] leading-tight sm:text-5xl">{title}</h1>
        </div>
      </header>
      <main className={`safe-x mx-auto w-full flex-1 pt-3 pb-6 ${wide ? "max-w-7xl" : "max-w-5xl"}`}>{children}</main>
    </div>
  );
}

/** Barra de ação principal, sempre alcançável acima das barras do navegador móvel. */
export function ActionBar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`pointer-events-none sticky bottom-0 z-30 -mx-4 mt-6 bg-linear-to-t from-espresso from-70% to-transparent px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] *:pointer-events-auto md:bg-none ${className}`}
    >
      <div className="mx-auto flex max-w-md flex-col items-stretch gap-2 text-center">{children}</div>
    </div>
  );
}
