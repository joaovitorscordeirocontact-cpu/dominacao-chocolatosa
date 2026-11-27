"use client";

import { AnimatePresence, motion } from "motion/react";
import layout from "@/data/accessory-layout.json";
import { BODY_COLORS, SLOT_IDS, SLOTS } from "@/lib/catalog";
import type { MascotLook } from "@/lib/types";

const { stage, items } = layout;
const percent = (value: number, total: number) => `${(value / total) * 100}%`;

export function describeLook({ color, accessories }: MascotLook) {
  const colorLabel = BODY_COLORS.find((option) => option.id === color)?.label.toLowerCase();
  const worn = SLOT_IDS.flatMap((slot) => {
    const item = SLOTS[slot].items.find((option) => option.id === accessories[slot]);
    return item ? [item.label.toLowerCase()] : [];
  });
  return `Mascote ${colorLabel}${worn.length ? ` com ${worn.join(", ")}` : ""}`;
}

/**
 * Mascote montado em camadas. Ocupa 100% da largura do contêiner na proporção
 * do palco definido em accessory-layout.json. Só o corpo muda de cor.
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
  const worn = SLOT_IDS.flatMap((slot) => look.accessories[slot] ?? []);

  return (
    <div
      className={`relative w-full select-none ${className}`}
      style={{ aspectRatio: `${stage.width} / ${stage.height}` }}
      role="img"
      aria-label={describeLook(look)}
    >
      <motion.img
        // A troca de cor dá um pequeno "pulo" no corpo.
        key={look.color}
        src={`/assets/personagem/corpo-${look.color}.webp`}
        alt=""
        draggable={false}
        initial={animated ? { scale: 0.95 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 16 }}
        className="absolute h-auto"
        style={{
          left: percent(stage.bodyX, stage.width),
          top: percent(stage.bodyY, stage.height),
          width: percent(stage.bodyWidth, stage.width),
          originY: 1,
        }}
      />
      <AnimatePresence initial={false}>
        {worn.map((id) => {
          const item = items[id];
          return (
            <motion.img
              key={id}
              src={`/assets/personagem/${id}.webp`}
              alt=""
              draggable={false}
              initial={animated ? { opacity: 0, y: -14, scale: 0.8 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={animated ? { opacity: 0, scale: 0.8, transition: { duration: 0.15 } } : { opacity: 0, transition: { duration: 0 } }}
              transition={{ type: "spring", stiffness: 380, damping: 20 }}
              className="absolute h-auto"
              style={{
                left: percent(stage.bodyX + item.cx - item.width / 2, stage.width),
                top: percent(stage.bodyY + item.top, stage.height),
                width: percent(item.width, stage.width),
                zIndex: item.z,
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
