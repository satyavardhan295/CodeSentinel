export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Fixed'

export interface Scan {
  id: string
  repoName: string
  source: 'upload' | 'github'
  branch: string
  status: 'queued' | 'scanning' | 'complete' | 'failed'
  score: number            // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  debtHours: number
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'
  startedAt: string        // ISO 8601
  durationSeconds: number
  linesOfCode: number
  languages: string[]
}

export interface Finding {
  id: string
  scanId: string
  title: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  category: string         // e.g. "Injection"
  cwe: string              // e.g. "CWE-89"
  owasp: string            // e.g. "A03:2021"
  filePath: string
  lineStart: number
  lineEnd: number
  codeSnippet: string
  description: string
  attackScenario: string
  aiFix: {
    before: string
    after: string
    explanation: string
  }
  effortHours: number
  pointsGainedIfFixed: number
  status: 'Open' | 'In progress' | 'Fixed' | 'Ignored'
  detectedAt: string
  notes: string
}

export interface DependencyIssue {
  id: string
  scanId: string
  package: string
  currentVersion: string
  fixedVersion: string
  cve: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  description: string
}

export interface SecretFinding {
  id: string
  scanId: string
  type: string             // e.g. "AWS Access Key"
  filePath: string
  line: number
  maskedValue: string      // last 4 chars visible, rest asterisked
  severity: 'Critical' | 'High'
  rotateUrl: string
}

export interface ConfigurationIssue {
  id: string
  scanId: string
  issue: string
  filePath: string
  rule: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  status: 'Open' | 'Fixed' | 'Ignored'
}

export interface DebtLedgerRow {
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  issues: number
  hoursToFix: number
  shareOfDebt: number // percentage
}

export interface FolderDebt {
  folder: string
  hours: number
  issueCount: number
}

export interface OwaspDistribution {
  category: string
  count: number
  hours: number
}

export interface ScanHistoryComparison {
  scanA: Scan
  scanB: Scan
  scoreDelta: number
  netDebtDeltaHours: number
  newIssuesCount: number
  resolvedIssuesCount: number
}
