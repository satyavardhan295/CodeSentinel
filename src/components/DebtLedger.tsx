import React from 'react'
import { SeverityBadge } from './SeverityBadge'
import { DebtLedgerRow, SeverityLevel } from '../types'

interface DebtLedgerProps {
  rows: DebtLedgerRow[]
  secretsCount: number
  secretsFileCount: number
  depCount: number
  depSevereCount: number // rated High or Critical
}

export const DebtLedger: React.FC<DebtLedgerProps> = ({
  rows,
  secretsCount,
  secretsFileCount,
  depCount,
  depSevereCount
}) => {
  const totalIssues = rows.reduce((sum, r) => sum + r.issues, 0)
  const totalPoints = rows.reduce((sum, r) => sum + r.pointsLost, 0)

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-xs text-muted font-medium">
              <th className="py-2.5 pr-6 font-medium">Severity</th>
              <th className="py-2.5 px-6 font-medium text-right">Issues</th>
              <th className="py-2.5 px-6 font-medium text-right">Points lost</th>
              <th className="py-2.5 pl-6 font-medium text-right">Share of issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map(row => (
              <tr key={row.severity} className="hover:bg-surface/50 transition-colors">
                <td className="py-3 pr-6">
                  <SeverityBadge severity={row.severity as SeverityLevel} />
                </td>
                <td className="py-3 px-6 text-right font-medium text-ink">{row.issues}</td>
                <td className="py-3 px-6 text-right text-muted">
                  {row.pointsLost > 0 ? `−${row.pointsLost}` : '0'}
                </td>
                <td className="py-3 pl-6 text-right text-muted">{row.shareOfIssues}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-medium text-ink">
              <td className="py-3 pr-6 font-semibold">Total</td>
              <td className="py-3 px-6 text-right font-semibold">{totalIssues}</td>
              <td className="py-3 px-6 text-right font-semibold">
                {totalPoints > 0 ? `−${Math.min(totalPoints, 100)}` : '0'}
              </td>
              <td className="py-3 pl-6 text-right font-semibold">{totalIssues > 0 ? '100%' : '0%'}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3.5 space-y-1 text-sm text-muted">
        <div>
          {secretsCount} hardcoded {secretsCount === 1 ? 'secret' : 'secrets'} found across{' '}
          {secretsFileCount} {secretsFileCount === 1 ? 'file' : 'files'}
        </div>
        <div>
          {depCount} dependency {depCount === 1 ? 'advisory' : 'advisories'}, {depSevereCount} rated
          high or critical
        </div>
      </div>
    </div>
  )
}
