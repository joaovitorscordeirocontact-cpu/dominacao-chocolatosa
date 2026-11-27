import { STAGE } from "@/lib/mascot-layers";
import type { MascotLook } from "@/lib/types";
import { Mascot } from "./Mascot";

/** Região quadrada do palco mostrada no círculo: cabeça, acessórios e tronco. */
const CROP = { x: 4, y: 14, size: 636 };

export function Avatar({ look, className = "size-16" }: { look: MascotLook; className?: string }) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full border-2 border-gold bg-[radial-gradient(circle_at_50%_35%,#fff0dd,#f0a8b7_55%,#b9657c)] shadow-[0_6px_14px_-6px_#000] ${className}`}
    >
      <span
        className="absolute block"
        style={{
          width: `${(STAGE.width / CROP.size) * 100}%`,
          left: `${(-CROP.x / CROP.size) * 100}%`,
          top: `${(-CROP.y / CROP.size) * 100}%`,
        }}
      >
        <Mascot look={look} />
      </span>
    </span>
  );
}
