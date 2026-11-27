"use client";

/* eslint-disable @next/next/no-img-element */
import { ActionBar } from "@/components/ui/Screen";
import { asset } from "@/lib/assets";
import { BACKGROUNDS, FACTORY_MODELS, FACTORY_NAME_MAX_LENGTH } from "@/lib/catalog";
import type { FactoryIdentity } from "@/lib/types";
import { FactoryCard } from "./FactoryCard";

/** Escolha de nome, modelo e fundo da fábrica (controlada). */
export function FactoryPicker({
  draft,
  captainName,
  onChange,
  footer,
}: {
  draft: FactoryIdentity;
  captainName: string;
  onChange: (draft: FactoryIdentity) => void;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-w-0 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-6">
      <div className="mb-3 md:sticky md:top-4 md:self-start">
        <FactoryCard factory={draft} captainName={captainName} placeholder="Nome da fábrica" />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="panel p-4">
          <label htmlFor="fabrica" className="mb-2 block font-extrabold">
            Nome da fábrica
          </label>
          <input
            id="fabrica"
            className="field"
            value={draft.name}
            maxLength={FACTORY_NAME_MAX_LENGTH}
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Ex.: Brigadeiro Veloz"
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
        </div>

          <fieldset className="panel p-4">
            <legend className="sr-only">Modelo da fábrica</legend>
            <p className="mb-3 font-extrabold" aria-hidden="true">
              Modelo da fábrica
            </p>
            <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-3 lg:grid-cols-5 md:max-lg:grid-cols-3">
              {FACTORY_MODELS.map((model) => {
                const selected = draft.model === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ ...draft, model: model.id })}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 p-2 text-xs leading-tight font-bold transition-transform active:scale-95 ${
                      selected ? "border-gold bg-gold/20" : "border-cream/10 bg-cream/6"
                    }`}
                  >
                    <img
                      src={asset(`/assets/fabricas/${model.id}.webp`)}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full object-contain"
                    />
                    <span>
                      {selected && <span aria-hidden="true">✓ </span>}
                      {model.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="panel p-4">
            <legend className="sr-only">Fundo</legend>
            <p className="mb-3 font-extrabold" aria-hidden="true">
              Fundo
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-3 lg:grid-cols-5">
              {BACKGROUNDS.map((background) => {
                const selected = draft.background === background.id;
                return (
                  <button
                    key={background.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ ...draft, background: background.id })}
                    className={`cursor-pointer overflow-hidden rounded-2xl border-2 text-xs leading-tight font-bold transition-transform active:scale-95 ${
                      selected ? "border-gold bg-gold/20" : "border-cream/10 bg-cream/6"
                    }`}
                  >
                    <span className={`fundo-${background.id} block h-14`} />
                    <span className="flex min-h-10 items-center justify-center px-1">
                      {selected && <span aria-hidden="true">✓&nbsp;</span>}
                      {background.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
      </div>

      <ActionBar className="md:col-span-2">{footer}</ActionBar>
    </div>
  );
}
