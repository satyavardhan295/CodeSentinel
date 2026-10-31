import React from 'react'
import { SeverityBadge } from './SeverityBadge'
import { DebtLedgerRow, SeverityLevel } from '../types'

interface DebtLedgerProps {
  rows?: DebtLedgerRow[]
  secretsCount?: number
  secretsFileCount?: number
  depCount?: number
  depExploitCount?: number
}

const defaultRows: DebtLedgerRow[] = [
  { severity: 'Critical', issues: 3, hoursToFix: 14, shareOfDebt: 34 },
  { severity: 'High', issues: 8, hoursToFix: 18, shareOfDebt: 44 },
  { severity: 'Medium', issues: 9, hoursToFix: 7, shareOfDebt: 17 },
  { severity: 'Low', issues: 6, hoursToFix: 2, shareOfDebt: 5 }
]

export const DebtLedger: React.FC<DebtLedgerProps> = ({
  rows = defaultRows,
  secretsCount = 4,
  secretsFileCount = 3,
  depCount = 6,
  depExploitCount = 2
}) => {
  const totalIssues = rows.reduce((sum, r) => sum + r.issues, 0)
  const totalHours = rows.reduce((sum, r) => sum + r.hoursToFix, 0)
  const totalShare = 100

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-xs text-muted font-medium">
              <th className="py-2.5 pr-6 font-medium">Severity</th>
              <th className="py-2.5 px-6 font-medium text-right">Issues</th>
              <th className="py-2.5 px-6 font-medium text-right">Hours to fix</th>
              <th className="py-2.5 pl-6 font-medium text-right">Share of debt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map(row => (
              <tr key={row.severity} className="hover:bg-surface/50 transition-colors">
                <td className="py-3 pr-6">
                  <SeverityBadge severity={row.severity as SeverityLevel} />
                </td>
                <td className="py-3 px-6 text-right font-medium text-ink">
                  {row.issues}
                </td>
                <td className="py-3 px-6 text-right text-muted">
                  {row.hoursToFix} h
                </td>
                <td className="py-3 pl-6 text-right text-muted">
                  {row.shareOfDebt}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-medium text-ink">
              <td className="py-3 pr-6 font-semibold">Total</td>
              <td className="py-3 px-6 text-right font-semibold">{totalIssues}</td>
              <td className="py-3 px-6 text-right font-semibold">{totalHours} h</td>
              <td className="py-3 pl-6 text-right font-semibold">{totalShare}%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3.5 space-y-1 text-sm text-muted">
        <div>{secretsCount} hardcoded secrets found across {secretsFileCount} files</div>
        <div>{depCount} vulnerable dependencies, {depExploitCount} with known exploits</div>
      </div>
    </div>
  )
}
