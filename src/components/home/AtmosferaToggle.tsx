"use client";

import { updateDemo, useDemoState, useHydrated } from "@/lib/store";

export function AtmosferaToggle({ className = "" }: { className?: string }) {
  const { settings } = useDemoState();
  const hydrated = useHydrated();

  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-gold/35 bg-espresso/80 px-3 text-xs font-bold text-cream ${className}`}
    >
      <input
        type="checkbox"
        className="size-5 accent-pink"
        checked={settings.showAtmosfera}
        disabled={!hydrated}
        onChange={(event) => {
          const showAtmosfera = event.target.checked;
          updateDemo((state) => ({ ...state, settings: { ...state.settings, showAtmosfera } }));
        }}
      />
      Mostrar “Atmosfera Jovem”
    </label>
  );
}
