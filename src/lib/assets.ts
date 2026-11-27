/** Prefixo do site quando publicado em subpasta (ex.: GitHub Pages: /nome-do-repositorio). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Caminho de um arquivo de /public, já com o basePath. */
export const asset = (path: string) => `${BASE_PATH}${path}`;
