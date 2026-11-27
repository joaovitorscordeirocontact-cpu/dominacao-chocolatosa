/**
 * Tudo o que o aparelho lembra de uma sala fica em memória. Nada de sala vai
 * para o armazenamento do navegador, que guarda só a identidade anônima e o
 * mascote (e, enquanto "Criar sala" não responde, o identificador do pedido).
 * Os dados da partida vivem no estado das telas e somem quando elas saem; aqui
 * ficam os registros visuais que duram mais que uma tela.
 */

/** Aberturas já animadas (`<sala>-<maleta>` ou `espiada-<sala>-<maleta>`). */
export const openedCases = new Set<string>();

/** Última fábrica de cada maleta (`<sala>-<maleta>`), para animar a troca. */
export const casePositions = new Map<string, string>();

export function forgetRoom(roomId: string) {
  for (const collection of [openedCases, casePositions]) {
    for (const key of [...collection.keys()]) {
      if (key.includes(roomId)) collection.delete(key);
    }
  }
}

/**
 * Códigos que ESTE aparelho está apagando. O aviso do banco pode chegar antes
 * da resposta: enquanto isso, quem pediu não vê "apagada pelo moderador".
 */
export const deletingHere = new Set<string>();

/** Código recém-apagado por este aparelho, para "Minhas salas" confirmar. */
export const justDeleted = { code: "" };
