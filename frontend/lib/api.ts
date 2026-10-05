import type { CheckStatus, CheckSummary, Report } from './types'
const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001'

async function getToken() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch('/api/auth/token', { cache: 'no-store' })
      const result = response.ok ? await response.json() as { token?: string } : {}
      if (result.token) return result.token
    } catch {
      // Retry one transient auth proxy failure before treating the session as expired.
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error('Your session has expired. Please sign in again.')
}

async function authenticatedFetch(path: string, init?: RequestInit) {
  const token = await getToken()
  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  })
}

export async function getCheckStatus(id: string): Promise<CheckStatus> {
  const response = await authenticatedFetch(`/api/checks/${id}`); if (!response.ok) throw new Error('Could not load check status'); return response.json()
}
export async function getReport(id: string): Promise<Report> { const response = await authenticatedFetch(`/api/checks/${id}/report`); if (!response.ok) throw new Error('Could not load report'); return response.json() }
export async function createCheck(form: FormData) { const response = await authenticatedFetch('/api/checks', { method: 'POST', body: form }); if (!response.ok) throw new Error('Could not start check'); return response.json() as Promise<{ check_id: string }> }
export async function listChecks(): Promise<CheckSummary[]> { const response = await authenticatedFetch('/api/checks'); if (!response.ok) throw new Error('Could not load check history'); return response.json() }
