import { FitName } from "@/components/ui/FitName";
import { teamColor } from "@/lib/catalog";
import { caseDescription, signed, type TeamView } from "@/lib/room/model";
import type { SettlementRow } from "@/lib/room/types";

/** Conferência por fábrica: de onde sai o saldo final. */
export function SettlementList({ rows, teams, paid }: { rows: SettlementRow[]; teams: TeamView[]; paid: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {teams.map((team) => {
        const row = rows.find((item) => item.teamId === team.id);
        if (!row) return null;
        const lines: [string, string][] = [
          ["Saldo inicial", String(row.startBalance)],
          ["Maleta final", `nº ${row.caseNumber} · ${caseDescription(row.caseKind, row.caseAmount)}`],
          ["Efeito calculado", signed(row.delta)],
          [
            "Proteção",
            !row.blocked ? "—" : row.delta < 0 ? `Bloqueio anulou ${signed(row.delta)}` : "Bloqueio sem efeito",
          ],
          ["Bônus", signed(row.bonus)],
        ];
        return (
          <li
            key={team.id}
            data-settlement={team.slot}
            className="min-w-0 rounded-2xl border-2 border-t-8 bg-chocolate/90 p-3"
            style={{ borderColor: teamColor(team.slot) }}
          >
            <FitName className="text-lg leading-tight font-black">{team.label}</FitName>
            <dl className="mt-2 grid gap-1 text-sm">
              {lines.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 rounded-lg bg-espresso/60 px-2 py-1">
                  <dt className="shrink-0 text-cream/80">{label}</dt>
                  <dd className="text-right font-extrabold">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 rounded-lg bg-cream px-3 py-1 text-espresso">
                <dt className="font-black">{paid ? "Saldo pago" : "Saldo final"}</dt>
                <dd className="font-display text-3xl">{row.finalBalance}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
