"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Avatar } from "@/components/mascot/Avatar";
import { Mascot } from "@/components/mascot/Mascot";
import { ActionBar } from "@/components/ui/Screen";
import { asset } from "@/lib/assets";
import { ACCESSORY_GROUPS, BODY_COLORS, HAIR_COLORS, NAME_MAX_LENGTH, SLOT_IDS, SLOTS } from "@/lib/catalog";
import { accessoryLayers } from "@/lib/mascot-layers";
import type { AccessoryId, AccessorySlot, MascotLook, Profile } from "@/lib/types";

/** Miniatura da peça: cabelo na cor escolhida; capa mostrando o tecido. */
function thumbnail(id: AccessoryId, look: MascotLook): string {
  const layers = accessoryLayers({ ...look, accessories: { [slotOf(id)]: id } });
  return (id === "cabelo-longo" ? layers.at(-1) : layers[0])!.file;
}

const slotOf = (id: AccessoryId) => SLOT_IDS.find((slot) => SLOTS[slot].items.some((item) => item.id === id))!;

function wear(profile: Profile, slot: AccessorySlot, id: AccessoryId | undefined): Profile {
  const accessories = { ...profile.accessories };
  if (id) accessories[slot] = id;
  else delete accessories[slot];
  return { ...profile, accessories };
}

function HairColorPicker({ profile, onChange }: { profile: Profile; onChange: (profile: Profile) => void }) {
  const hasHair = Boolean(profile.accessories.cabelo);
  return (
    <div className="mt-3" role="group" aria-label="Cor do cabelo">
      <p className="mb-2 text-sm font-bold text-blush" aria-hidden="true">
        Cor do cabelo{hasHair ? "" : " · escolha um cabelo primeiro"}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-3 lg:grid-cols-5">
        {HAIR_COLORS.map((option) => {
          const selected = profile.hairColor === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              disabled={!hasHair}
              onClick={() => onChange({ ...profile, hairColor: option.id })}
              className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 text-xs font-bold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${
                selected ? "border-gold bg-gold/15" : "border-transparent bg-espresso/60"
              }`}
            >
              <span
                className="size-7 rounded-full shadow-[inset_0_-5px_7px_rgb(0_0_0/0.35),inset_0_3px_5px_rgb(255_255_255/0.4)] ring-1 ring-cream/50"
                style={{ background: option.swatch }}
              />
              <span>
                {selected && <span aria-hidden="true">✓ </span>}
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Editor controlado do nome e do mascote. Quem usa decide o que fazer com as
 * mudanças e qual é a ação principal (`footer`).
 */
export function CharacterEditor({
  profile,
  onChange,
  footer,
  disabled = false,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
  footer: React.ReactNode;
  disabled?: boolean;
}) {
  const [groupId, setGroupId] = useState(ACCESSORY_GROUPS[0].id);
  const group = ACCESSORY_GROUPS.find((option) => option.id === groupId) ?? ACCESSORY_GROUPS[0];
  const hasAccessories = Object.keys(profile.accessories).length > 0;

  return (
    <fieldset disabled={disabled} className="min-w-0 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8">
      <legend className="sr-only">Personalização do mascote</legend>

      {/* Prévia grande, fixa no topo enquanto as opções rolam. */}
      <div className="sticky top-0 z-20 -mx-4 bg-linear-to-b from-espresso from-75% to-transparent px-4 pt-1 pb-4 md:top-4 md:mx-0 md:self-start md:bg-none md:px-0">
        <div className="relative mx-auto rounded-3xl bg-espresso">
          <div className="panel relative flex justify-center overflow-hidden py-2">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(55%_55%_at_50%_45%,rgb(245_43_135/0.35),transparent_70%),radial-gradient(70%_16%_at_50%_94%,rgb(239_200_121/0.45),transparent_70%)]"
            />
            <div className="relative w-[min(56vw,26svh,15rem)] md:w-[min(100%,56svh,26rem)]">
              <Mascot look={profile} animated />
            </div>
            <div className="absolute bottom-2 left-2 flex flex-col items-center gap-1" aria-hidden="true">
              <Avatar look={profile} className="size-14" />
              <span className="rounded-full bg-espresso/80 px-2 text-[0.65rem] font-bold">na lista</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="panel p-4">
          <label htmlFor="nome" className="mb-2 block font-extrabold">
            Seu nome
          </label>
          <input
            id="nome"
            className="field"
            value={profile.name}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Como vão te chamar?"
            autoComplete="nickname"
            enterKeyHint="done"
            onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
            onChange={(event) => onChange({ ...profile, name: event.target.value })}
          />
        </div>

        <fieldset className="panel p-4">
          <legend className="sr-only">Cor do corpo</legend>
          <p className="mb-3 font-extrabold" aria-hidden="true">
            Cor do corpo
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {BODY_COLORS.map((color) => {
              const selected = profile.color === color.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ ...profile, color: color.id })}
                  className={`flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 text-xs font-bold transition-transform active:scale-95 ${
                    selected ? "border-gold bg-gold/15" : "border-transparent bg-espresso/60"
                  }`}
                >
                  <span
                    className="size-9 rounded-full shadow-[inset_0_-6px_8px_rgb(0_0_0/0.35),inset_0_3px_5px_rgb(255_255_255/0.4)] ring-1 ring-cream/50"
                    style={{ background: color.swatch }}
                  />
                  <span>
                    {selected && <span aria-hidden="true">✓ </span>}
                    {color.label}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-extrabold">Acessórios</h2>
            <button
              type="button"
              className="btn btn-ghost min-h-11! px-3! py-1! text-xs"
              disabled={!hasAccessories}
              onClick={() => onChange({ ...profile, accessories: {} })}
            >
              Tirar tudo
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-full bg-espresso/80 p-1">
            {ACCESSORY_GROUPS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === group.id}
                onClick={() => setGroupId(option.id)}
                className={`min-h-11 cursor-pointer rounded-full text-sm font-extrabold ${
                  option.id === group.id ? "bg-[#c8105f] text-white" : "text-cream/85"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {group.slots.map((slot) => (
            <fieldset key={slot} className="mt-4">
              <legend className="mb-2 text-sm font-bold text-blush">{SLOTS[slot].label} · escolha um ou nenhum</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4">
                {[{ id: undefined, label: slot === "cabelo" ? "Sem cabelo" : "Nenhum" }, ...SLOTS[slot].items].map((item) => {
                  const selected = profile.accessories[slot] === item.id;
                  return (
                    <button
                      key={item.id ?? "nenhum"}
                      type="button"
                      aria-pressed={selected}
                      // Tocar de novo num acessório equipado também o retira.
                      onClick={() => onChange(wear(profile, slot, selected ? undefined : item.id))}
                      className={`relative flex min-h-24 cursor-pointer flex-col items-center justify-between gap-1 rounded-2xl border-2 p-2 text-center text-xs leading-tight font-bold transition-transform active:scale-95 ${
                        selected ? "border-gold bg-gold/20" : "border-cream/10 bg-cream/8"
                      }`}
                    >
                      <span className="flex h-14 w-full items-center justify-center">
                        {item.id ? (
                          <img
                            src={asset(`/assets/personagem/${thumbnail(item.id, profile)}.webp`)}
                            alt=""
                            loading="lazy"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span aria-hidden="true" className="size-10 rounded-full border-3 border-dashed border-cream/40" />
                        )}
                      </span>
                      {item.label}
                      {selected && (
                        <span
                          aria-hidden="true"
                          className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-gold text-[0.7rem] text-espresso"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {slot === "cabelo" && <HairColorPicker profile={profile} onChange={onChange} />}
            </fieldset>
          ))}
        </div>
      </div>

      <ActionBar className="md:col-span-2">{footer}</ActionBar>
    </fieldset>
  );
}
