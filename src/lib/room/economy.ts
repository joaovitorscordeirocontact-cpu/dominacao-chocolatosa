/**
 * Prévia da economia para o formulário do moderador. A decisão que vale é a do
 * banco (dominacao.economy); um teste garante que os dois fazem a mesma conta.
 */
export const BONUS_RESERVE = 8 * 2 + 4 * 4; // oito +2 e quatro +4
export const MIN_GAIN_BUDGET = 62; // soma dos pesos das 30 maletas de ganho

export function planEconomy(total: number, initialPerTeam: number, teams: number) {
  const initialTotal = teams * initialPerTeam;
  const gainBudget = total - initialTotal - BONUS_RESERVE;
  return {
    ok: gainBudget >= MIN_GAIN_BUDGET,
    teams,
    total,
    initialPerTeam,
    initialTotal,
    bonusReserve: BONUS_RESERVE,
    gainBudget,
    minGainBudget: MIN_GAIN_BUDGET,
    minTotal: initialTotal + BONUS_RESERVE + MIN_GAIN_BUDGET,
    maxInitialPerTeam: Math.max(Math.floor((total - BONUS_RESERVE - MIN_GAIN_BUDGET) / teams), -1),
  };
}
