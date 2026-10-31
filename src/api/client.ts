import {
  Scan,
  Finding,
  DependencyIssue,
  SecretFinding,
  ConfigurationIssue,
  GitHubConnection,
  GitHubRepo,
  User
} from '../types'

/** Fired when the server says the session is gone, so the app can show the sign-in page. */
export const UNAUTHORIZED_EVENT = 'codesentinel:unauthorized'

// Same origin by default: the backend serves the built app, and `npm run dev`
// proxies /api to it. Set VITE_API_URL only if the API lives on another origin.
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export interface StartScanPayload {
  source: 'upload' | 'github'
  files?: File[]
  repoUrl?: string
  branch?: string
  token?: string
  scanTypes: string[]
}

/**
 * Fetch wrapper: parses JSON and turns backend errors into Error objects whose
 * message is the API's human-readable `detail`, ready to show in the UI.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    // credentials: send the session cookie (also when VITE_API_URL is another origin)
    res = await fetch(`${BASE_URL}${path}`, { credentials: 'include', ...init })
  } catch {
    throw new Error('Cannot reach the CodeSentinel server. Check your connection and try again.')
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    // Session expired or revoked while using the app (sign-in calls handle their own 401s)
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    const detail = body?.detail
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail) // FastAPI 422 validation errors
        ? detail.map((d: { msg: string }) => d.msg.replace(/^Value error, /, '')).join('; ')
        : `Request failed with status ${res.status}`
    throw new Error(message)
  }
  return body as T
}

const jsonInit = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})

// ── Accounts ─────────────────────────────────────────────────────

/** Whether new accounts can be created on this server. GET /api/auth/config */
export async function getAuthConfig(): Promise<{ allowSignups: boolean }> {
  return request('/api/auth/config')
}

/** The signed-in user. Rejects (401) when nobody is signed in. GET /api/auth/me */
export async function getCurrentUser(): Promise<User> {
  return request('/api/auth/me')
}

/** POST /api/auth/signup (signs the new user in) */
export async function signUp(name: string, email: string, password: string): Promise<User> {
  return request('/api/auth/signup', jsonInit('POST', { name, email, password }))
}

/** POST /api/auth/login */
export async function logIn(email: string, password: string): Promise<User> {
  return request('/api/auth/login', jsonInit('POST', { email, password }))
}

/** POST /api/auth/logout */
export async function logOut(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' })
}

/** Changes the password and signs out every other browser. POST /api/auth/change-password */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('/api/auth/change-password', jsonInit('POST', { currentPassword, newPassword }))
}

/** Permanently deletes the account and all of its scans. DELETE /api/auth/account */
export async function deleteAccount(password: string): Promise<void> {
  await request('/api/auth/account', jsonInit('DELETE', { password }))
}

// ── Scans ────────────────────────────────────────────────────────

/**
 * Initiates a new code debt scan.
 * POST /api/scans
 */
export async function startScan(payload: StartScanPayload): Promise<{ scanId: string }> {
  const form = new FormData()
  form.append('source', payload.source)
  form.append('branch', payload.branch || 'main')
  form.append('scan_types', JSON.stringify(payload.scanTypes))
  if (payload.repoUrl) form.append('repo_url', payload.repoUrl)
  if (payload.token) form.append('token', payload.token)
  for (const file of payload.files ?? []) {
    // Keep folder structure when a directory was picked
    form.append('files', file, file.webkitRelativePath || file.name)
  }
  return request('/api/scans', { method: 'POST', body: form })
}

/**
 * Retrieves the status and high-level progress of a scan.
 * GET /api/scans/:scanId/status
 */
export async function getScanStatus(scanId: string): Promise<Scan> {
  return request(`/api/scans/${encodeURIComponent(scanId)}/status`)
}

/**
 * Retrieves the comprehensive security debt report for a scan.
 * GET /api/scans/:scanId/report
 */
export async function getScanReport(scanId: string): Promise<{
  scan: Scan
  findings: Finding[]
  dependencies: DependencyIssue[]
  secrets: SecretFinding[]
  configurations: ConfigurationIssue[]
}> {
  return request(`/api/scans/${encodeURIComponent(scanId)}/report`)
}

/**
 * Lists past codebase scans, newest first.
 * GET /api/scans
 */
export async function listScans(): Promise<Scan[]> {
  return request('/api/scans')
}

/**
 * Deletes a finished or failed scan and all of its results.
 * DELETE /api/scans/:scanId
 */
export async function deleteScan(scanId: string): Promise<void> {
  await request(`/api/scans/${encodeURIComponent(scanId)}`, { method: 'DELETE' })
}

/**
 * Updates finding status (Open, In progress, Fixed, Ignored) or private team notes.
 * PATCH /api/findings/:findingId
 */
export async function updateFinding(
  findingId: string,
  patch: Partial<Pick<Finding, 'status' | 'notes'>>
): Promise<Finding> {
  return request(`/api/findings/${encodeURIComponent(findingId)}`, jsonInit('PATCH', patch))
}

/**
 * Marks a configuration issue Open, Fixed or Ignored.
 * PATCH /api/configurations/:configurationId
 */
export async function updateConfiguration(
  configurationId: string,
  patch: Pick<ConfigurationIssue, 'status'>
): Promise<ConfigurationIssue> {
  return request(
    `/api/configurations/${encodeURIComponent(configurationId)}`,
    jsonInit('PATCH', patch)
  )
}

/**
 * The GitHub account connected in Settings (never includes the token).
 * GET /api/github/connection
 */
export async function getGitHubConnection(): Promise<GitHubConnection> {
  return request('/api/github/connection')
}

/**
 * Verifies a personal access token with GitHub and saves it on the backend.
 * POST /api/github/connection
 */
export async function connectGitHub(token: string): Promise<GitHubConnection> {
  return request('/api/github/connection', jsonInit('POST', { token }))
}

/**
 * Forgets the saved token.
 * DELETE /api/github/connection
 */
export async function disconnectGitHub(): Promise<GitHubConnection> {
  return request('/api/github/connection', { method: 'DELETE' })
}

/**
 * Repositories the connected account can access, most recently updated first.
 * GET /api/github/repos
 */
export async function listGitHubRepos(): Promise<GitHubRepo[]> {
  return request('/api/github/repos')
}

/**
 * Interactive AI query panel for a specific vulnerability.
 * POST /api/findings/:findingId/chat
 */
export async function chatAboutFinding(
  findingId: string,
  message: string
): Promise<{ reply: string }> {
  return request(`/api/findings/${encodeURIComponent(findingId)}/chat`, jsonInit('POST', { message }))
}
