"use client";

import { AnimatePresence, motion } from "motion/react";
import { BODY_COLORS, HAIR_COLORS, SLOT_IDS, SLOTS } from "@/lib/catalog";
import { asset } from "@/lib/assets";
import { accessoryLayers, BODY_Z, percent, STAGE } from "@/lib/mascot-layers";
import type { MascotLook } from "@/lib/types";

export function describeLook({ color, hairColor, accessories }: MascotLook) {
  const colorLabel = BODY_COLORS.find((option) => option.id === color)?.label.toLowerCase();
  const worn = SLOT_IDS.flatMap((slot) => {
    const item = SLOTS[slot].items.find((option) => option.id === accessories[slot]);
    if (!item) return [];
    if (slot !== "cabelo") return [item.label.toLowerCase()];
    const hair = HAIR_COLORS.find((option) => option.id === hairColor)?.label.toLowerCase();
    return [`cabelo ${item.label.toLowerCase()} ${hair}`];
  });
  return `Mascote ${colorLabel}${worn.length ? ` com ${worn.join(", ")}` : ""}`;
}

/**
 * Mascote montado em camadas, de trás para frente: capa, cabelo de trás, corpo,
 * cabelo da frente, rosto, chapéu e fecho. Ocupa 100% da largura do contêiner na
 * proporção do palco. A cor do corpo e a do cabelo são independentes.
 */
export function Mascot({
  look,
  animated = false,
  className = "",
}: {
  look: MascotLook;
  animated?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative isolate w-full select-none ${className}`}
      style={{ aspectRatio: `${STAGE.width} / ${STAGE.height}` }}
      role="img"
      aria-label={describeLook(look)}
    >
      <motion.img
        // A troca de cor dá um pequeno "pulo" no corpo.
        key={look.color}
        src={asset(`/assets/personagem/corpo-${look.color}.webp`)}
        alt=""
        draggable={false}
        initial={animated ? { scale: 0.95 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 16 }}
        className="absolute h-auto"
        style={{
          left: percent(STAGE.bodyX, STAGE.width),
          top: percent(STAGE.bodyY, STAGE.height),
          width: percent(STAGE.bodyWidth, STAGE.width),
          zIndex: BODY_Z,
          originY: 1,
        }}
      />
      <AnimatePresence initial={false}>
        {accessoryLayers(look).map((layer) => (
          <motion.img
            // A cor não entra na chave: trocar a cor do cabelo não reanima a peça.
            key={layer.key}
            data-layer={layer.key}
            src={asset(`/assets/personagem/${layer.file}.webp`)}
            alt=""
            draggable={false}
            initial={animated ? { opacity: 0, y: -14, scale: 0.8 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: animated ? 0.15 : 0 } }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            className="absolute"
            style={{
              left: percent(STAGE.bodyX + layer.left, STAGE.width),
              top: percent(STAGE.bodyY + layer.top, STAGE.height),
              width: percent(layer.width, STAGE.width),
              height: percent(layer.height, STAGE.height),
              zIndex: layer.z,
              clipPath: layer.clipPath,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
