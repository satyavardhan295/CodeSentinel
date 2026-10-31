import {
  ConfigurationIssue,
  DebtLedgerRow,
  DependencyIssue,
  Finding,
  Scan,
  SecretFinding
} from '../types'

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const
export type IssueSeverity = (typeof SEVERITIES)[number]

// Relative danger of one open issue at each severity
export const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  Critical: 10,
  High: 6,
  Medium: 3,
  Low: 1
}

// Mirrors secdebt-backend/app/services/scorer.py: [points per issue, cap]
const WEIGHTS: Record<Finding['severity'], [number, number]> = {
  Critical: [18, 54],
  High: [10, 40],
  Medium: [4, 20],
  Low: [1, 10]
}

/** Findings still counting against the score. */
export const openFindings = (findings: Finding[]) =>
  findings.filter(f => f.status !== 'Fixed' && f.status !== 'Ignored')

export function scoreFor(findings: Finding[]): number {
  const deductions = SEVERITIES.reduce((sum, sev) => {
    const [perIssue, cap] = WEIGHTS[sev]
    const count = findings.filter(f => f.severity === sev).length
    return sum + Math.min(count * perIssue, cap)
  }, 0)
  return Math.max(0, 100 - deductions)
}

export function ledgerRows(findings: Finding[]): DebtLedgerRow[] {
  return SEVERITIES.map(severity => {
    const count = findings.filter(f => f.severity === severity).length
    const [perIssue, cap] = WEIGHTS[severity]
    return {
      severity,
      issues: count,
      pointsLost: Math.min(count * perIssue, cap),
      shareOfIssues: findings.length > 0 ? Math.round((count / findings.length) * 100) : 0
    }
  })
}

// OWASP Top 10 (2021) names, so charts don't show bare codes
const OWASP_2021: Record<string, string> = {
  A01: 'Broken Access Control',
  A02: 'Cryptographic Failures',
  A03: 'Injection',
  A04: 'Insecure Design',
  A05: 'Security Misconfiguration',
  A06: 'Vulnerable Components',
  A07: 'Authentication Failures',
  A08: 'Integrity Failures',
  A09: 'Logging & Monitoring Failures',
  A10: 'Server-Side Request Forgery'
}

/** "A03 · Injection" for OWASP-tagged findings, otherwise the finding's category. */
export function owaspLabel(f: Finding): string {
  const code = f.owasp.match(/A(\d{2}):2021/)
  if (code) {
    const key = `A${code[1]}`
    return OWASP_2021[key] ? `${key} · ${OWASP_2021[key]}` : f.owasp
  }
  return f.category || 'Other'
}

/** Filesystem-safe name fragment for downloads. */
export const safeFileName = (s: string) =>
  s.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'scan'

export interface DangerRow {
  type: string
  Critical: number
  High: number
  Medium: number
  Low: number
  total: number
  riskScore: number
}

/**
 * Open issues of every kind grouped by vulnerability type and ranked by
 * weighted risk, so the most dangerous kind of weakness comes first.
 */
export function dangerByType(
  findings: Finding[],
  dependencies: DependencyIssue[],
  secrets: SecretFinding[],
  configurations: ConfigurationIssue[]
): DangerRow[] {
  const rows = new Map<string, DangerRow>()
  const add = (type: string, severity: IssueSeverity) => {
    const row =
      rows.get(type) ?? { type, Critical: 0, High: 0, Medium: 0, Low: 0, total: 0, riskScore: 0 }
    row[severity] += 1
    row.total += 1
    row.riskScore += SEVERITY_WEIGHT[severity]
    rows.set(type, row)
  }

  openFindings(findings).forEach(f => add(f.category || 'Other', f.severity))
  dependencies.forEach(d => add('Vulnerable dependencies', d.severity))
  secrets.forEach(s => add('Hardcoded secrets', s.severity))
  configurations
    .filter(c => c.status === 'Open')
    .forEach(c => add('Configuration issues', c.severity))

  return [...rows.values()].sort(
    (a, b) => b.riskScore - a.riskScore || b.Critical - a.Critical || a.type.localeCompare(b.type)
  )
}

/** Stable identity of a scan's repository: same key means same code base. */
export const repoKeyOf = (s: Scan) => s.repoKey || `${s.source}:${s.repoName.toLowerCase()}`

/** Human-readable repository name, including the GitHub owner when known. */
export function repoLabel(s: Scan): string {
  const [source, name] = repoKeyOf(s).split(/:(.*)/s)
  if (source === 'github' && name.includes('/')) {
    // Keep the original capitalisation of the repo name
    return `${name.slice(0, name.indexOf('/') + 1)}${s.repoName}`
  }
  return source === 'upload' ? `${s.repoName} (upload)` : s.repoName
}

export interface ComparedIssue {
  key: string
  kind: 'Code' | 'Dependency' | 'Secret' | 'Configuration'
  title: string
  location: string
  severity: IssueSeverity
}

/** Every unresolved issue in a report, keyed so the same issue matches across scans. */
export function activeIssues(report: {
  findings: Finding[]
  dependencies: DependencyIssue[]
  secrets: SecretFinding[]
  configurations: ConfigurationIssue[]
}): Map<string, ComparedIssue> {
  const map = new Map<string, ComparedIssue>()
  const add = (issue: ComparedIssue) => map.set(issue.key, issue)

  openFindings(report.findings).forEach(f =>
    add({
      key: `code|${f.filePath}|${f.cwe || f.title}`,
      kind: 'Code',
      title: f.title,
      location: `${f.filePath}:${f.lineStart}`,
      severity: f.severity
    })
  )
  report.dependencies.forEach(d =>
    add({
      key: `dep|${d.package}|${d.cve}`,
      kind: 'Dependency',
      title: `${d.package}@${d.currentVersion} (${d.cve})`,
      location: d.package,
      severity: d.severity
    })
  )
  report.secrets.forEach(s =>
    add({
      key: `secret|${s.type}|${s.filePath}|${s.line}`,
      kind: 'Secret',
      title: s.type,
      location: `${s.filePath}:${s.line}`,
      severity: s.severity
    })
  )
  report.configurations
    .filter(c => c.status === 'Open')
    .forEach(c =>
      add({
        key: `cfg|${c.rule}|${c.filePath}`,
        kind: 'Configuration',
        title: c.issue,
        location: c.filePath,
        severity: c.severity
      })
    )
  return map
}
