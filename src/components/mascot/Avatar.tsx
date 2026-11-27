import layout from "@/data/accessory-layout.json";
import type { MascotLook } from "@/lib/types";
import { Mascot } from "./Mascot";

/** Região quadrada do palco mostrada no círculo: cabeça, acessórios e tronco. */
const CROP = { x: 31, y: 6, size: 580 };

export function Avatar({ look, className = "size-16" }: { look: MascotLook; className?: string }) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full border-2 border-gold bg-[radial-gradient(circle_at_50%_30%,#8a5440,#3a1a13_75%)] shadow-[0_6px_14px_-6px_#000] ${className}`}
    >
      <span
        className="absolute block"
        style={{
          width: `${(layout.stage.width / CROP.size) * 100}%`,
          left: `${(-CROP.x / CROP.size) * 100}%`,
          top: `${(-CROP.y / CROP.size) * 100}%`,
        }}
      >
        <Mascot look={look} />
      </span>
    </span>
  );
}
