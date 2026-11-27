import { BASE_PATH } from "../assets.ts";
import type { MemberKind } from "./types.ts";

/** Código de convite: 6 caracteres, sem os ambíguos 0/O e 1/I. */
export function cleanCode(value: string | null | undefined): string {
  const code = (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code) ? code : "";
}

const ROUTES: Record<MemberKind, string> = { moderator: "moderador", player: "sala", screen: "telao" };

/** Caminho interno (o Next aplica o basePath em links e na navegação). */
export const roomPath = (kind: MemberKind, code: string) => `/${ROUTES[kind]}/?sala=${code}`;

/** Endereço completo para compartilhar, incluindo o basePath. */
export const shareUrl = (origin: string, path: "entrar" | "telao", code: string) =>
  `${origin}${BASE_PATH}/${path}/?sala=${code}`;
