"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/mascot/Avatar";
import { ActionBar } from "@/components/ui/Screen";
import { BACKGROUNDS, FACTORY_MODELS, FACTORY_NAME_MAX_LENGTH, NAME_MAX_LENGTH } from "@/lib/catalog";
import { setFactory, setProfile } from "@/lib/demo-state";
import { updateDemo, useDemoState, useHydrated } from "@/lib/store";
import { FactoryScene } from "./FactoryScene";

export function FactoryEditor() {
  const hydrated = useHydrated();
  // Remonta após a hidratação para o rascunho partir do que está salvo.
  return <FactoryForm key={String(hydrated)} disabled={!hydrated} />;
}

function FactoryForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const state = useDemoState();
  // Rascunho: só vira a identidade da fábrica ao confirmar.
  const [captain, setCaptain] = useState(state.profile.name);
  const [draft, setDraft] = useState(state.factory);
  const missing = [!captain.trim() && "o nome do capitão", !draft.name.trim() && "o nome da fábrica"].filter(Boolean);

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (missing.length) return;
    updateDemo((current) =>
      setFactory(setProfile(current, { name: captain.trim() }), { ...draft, name: draft.name.trim() }),
    );
    router.push("/lobby");
  }

  return (
    <form onSubmit={confirm}>
      <fieldset disabled={disabled} className="min-w-0 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8">
        <legend className="sr-only">Identidade da fábrica</legend>

        <div className="sticky top-0 z-20 -mx-4 bg-linear-to-b from-espresso from-80% to-transparent px-4 pt-1 pb-3 md:top-4 md:mx-0 md:self-start md:bg-none md:px-0">
          <figure className="mx-auto max-w-[min(100%,34svh)] overflow-hidden rounded-3xl border-2 border-gold/70 bg-espresso shadow-panel md:max-w-none">
            <FactoryScene factory={draft} className="aspect-16/11 md:aspect-4/3" />
            <figcaption className="flex items-center gap-3 border-t-2 border-gold/70 bg-chocolate px-3 py-2">
              <Avatar look={state.profile} className="size-11" />
              <span className="min-w-0">
                <strong className="gold-text block truncate text-xl font-normal">
                  {draft.name.trim() || "Nome da fábrica"}
                </strong>
                <span className="block truncate text-xs font-bold text-blush">
                  Capitão: {captain.trim() || "a definir"}
                </span>
              </span>
            </figcaption>
          </figure>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="panel grid gap-4 p-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            <div>
              <label htmlFor="capitao" className="mb-2 block font-extrabold">
                Nome do capitão
              </label>
              <input
                id="capitao"
                className="field"
                value={captain}
                maxLength={NAME_MAX_LENGTH}
                autoComplete="nickname"
                placeholder="Seu nome"
                onChange={(event) => setCaptain(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="fabrica" className="mb-2 block font-extrabold">
                Nome da fábrica
              </label>
              <input
                id="fabrica"
                className="field"
                value={draft.name}
                maxLength={FACTORY_NAME_MAX_LENGTH}
                autoComplete="off"
                placeholder="Ex.: Brigadeiro Veloz"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>
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
                    onClick={() => setDraft({ ...draft, model: model.id })}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 p-2 text-xs leading-tight font-bold transition-transform active:scale-95 ${
                      selected ? "border-gold bg-gold/20" : "border-cream/10 bg-cream/6"
                    }`}
                  >
                    <img
                      src={`/assets/fabricas/${model.id}.webp`}
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
                    onClick={() => setDraft({ ...draft, background: background.id })}
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

        <ActionBar className="md:col-span-2">
          <button type="submit" className="btn btn-primary text-lg" disabled={missing.length > 0}>
            Confirmar fábrica
          </button>
          {missing.length > 0 && !disabled && (
            <p className="text-sm font-bold text-blush">Falta informar {missing.join(" e ")}.</p>
          )}
        </ActionBar>
      </fieldset>
    </form>
  );
}
