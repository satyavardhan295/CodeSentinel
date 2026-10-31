import {
  Scan,
  Finding,
  DependencyIssue,
  SecretFinding,
  ConfigurationIssue
} from '../types'
import {
  mockCurrentScan,
  mockPastScans,
  mockFindings,
  mockDependencyIssues,
  mockSecretFindings,
  mockConfigurationIssues
} from './mockData'

// In-memory state holding mutable scans and findings for the session
let scansStore: Scan[] = [...mockPastScans]
let findingsStore: Finding[] = [...mockFindings]
let dependenciesStore: DependencyIssue[] = [...mockDependencyIssues]
let secretsStore: SecretFinding[] = [...mockSecretFindings]
let configurationsStore: ConfigurationIssue[] = [...mockConfigurationIssues]

// Helper to simulate network latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface StartScanPayload {
  source: 'upload' | 'github'
  files?: File[]
  repoUrl?: string
  branch?: string
  token?: string
  scanTypes: string[]
}

/**
 * Initiates a new code debt scan.
 * Real backend: POST /api/scans
 */
export async function startScan(payload: StartScanPayload): Promise<{ scanId: string }> {
  await delay(350)

  const repoName = payload.source === 'github' && payload.repoUrl
    ? payload.repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')
    : (payload.files?.[0]?.name ? payload.files[0].name.replace(/\.[^/.]+$/, '') : 'uploaded-archive')

  const newScanId = `scan_${Date.now()}`
  const newScan: Scan = {
    id: newScanId,
    repoName: repoName || 'custom-repo',
    source: payload.source,
    branch: payload.branch || 'main',
    status: 'scanning',
    score: 62,
    grade: 'D',
    debtHours: 41,
    riskLevel: 'Critical',
    startedAt: new Date().toISOString(),
    durationSeconds: 151,
    linesOfCode: 18742,
    languages: ['JavaScript', 'TypeScript']
  }

  scansStore = [newScan, ...scansStore]
  return { scanId: newScanId }
}

/**
 * Retrieves the status and high-level progress of a scan.
 * Real backend: GET /api/scans/:scanId/status
 */
export async function getScanStatus(scanId: string): Promise<Scan> {
  await delay(200)
  const found = scansStore.find(s => s.id === scanId) || mockCurrentScan
  return { ...found }
}

/**
 * Retrieves the comprehensive security debt report for a scan.
 * Real backend: GET /api/scans/:scanId/report
 */
export async function getScanReport(scanId: string): Promise<{
  scan: Scan
  findings: Finding[]
  dependencies: DependencyIssue[]
  secrets: SecretFinding[]
  configurations: ConfigurationIssue[]
}> {
  await delay(300)
  const scan = scansStore.find(s => s.id === scanId) || mockCurrentScan
  return {
    scan: { ...scan },
    findings: [...findingsStore],
    dependencies: [...dependenciesStore],
    secrets: [...secretsStore],
    configurations: [...configurationsStore]
  }
}

/**
 * Lists past codebase scans.
 * Real backend: GET /api/scans
 */
export async function listScans(): Promise<Scan[]> {
  await delay(250)
  return [...scansStore]
}

/**
 * Updates finding status (Open, In progress, Fixed, Ignored) or private team notes.
 * Real backend: PATCH /api/findings/:findingId
 */
export async function updateFinding(
  findingId: string,
  patch: Partial<Pick<Finding, 'status' | 'notes'>>
): Promise<Finding> {
  await delay(200)
  const index = findingsStore.findIndex(f => f.id === findingId)
  if (index === -1) {
    throw new Error(`Finding with ID ${findingId} not found`)
  }

  const updated: Finding = {
    ...findingsStore[index],
    ...patch
  }

  findingsStore[index] = updated
  return updated
}

/**
 * Interactive AI query panel for a specific vulnerability.
 * Real backend: POST /api/findings/:findingId/chat
 */
export async function chatAboutFinding(
  findingId: string,
  message: string
): Promise<{ reply: string }> {
  await delay(500)
  const finding = findingsStore.find(f => f.id === findingId)
  const lower = message.toLowerCase()

  if (lower.includes('fix') || lower.includes('how to')) {
    return {
      reply: `To remediate this ${finding?.title || 'issue'}, apply parameterized bindings and strict validation. ${finding?.aiFix.explanation || 'Review the suggested patch in the drawer above.'}`
    }
  }

  if (lower.includes('cve') || lower.includes('exploit') || lower.includes('attack')) {
    return {
      reply: `Attackers exploit this via unverified inputs. ${finding?.attackScenario || 'Refer to the attack scenario section for exact exploit mechanics.'}`
    }
  }

  return {
    reply: `In ${finding?.filePath || 'the affected file'}, the vulnerability stems from ${finding?.category || 'insufficient security controls'}. Applying the recommended remediation mitigates ${finding?.pointsGainedIfFixed || 2} points of risk liability.`
  }
}
