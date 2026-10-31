export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Fixed'

export interface Scan {
  id: string
  repoName: string
  repoKey?: string | null  // "github:owner/repo" or "upload:name"; same key = same repository
  source: 'upload' | 'github'
  branch: string
  status: 'queued' | 'scanning' | 'complete' | 'failed'
  score: number            // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'
  startedAt: string        // ISO 8601
  durationSeconds: number
  linesOfCode: number
  languages: string[]
  progressStep?: string | null  // live label while scanning
  progressPct?: number          // 0–100
  errorMessage?: string | null  // set when status is 'failed'
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

export interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

export interface GitHubConnection {
  connected: boolean
  username: string | null
  name: string | null
  avatarUrl: string | null
  profileUrl: string | null
  scopes: string[]          // classic token scopes; empty for fine-grained tokens
  connectedAt: string | null
}

export interface GitHubRepo {
  fullName: string          // owner/name
  name: string
  owner: string
  private: boolean
  defaultBranch: string
  htmlUrl: string
  description: string | null
  updatedAt: string | null
}

export interface DebtLedgerRow {
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  issues: number
  pointsLost: number  // score deducted for this severity (after caps)
  shareOfIssues: number // percentage
}
