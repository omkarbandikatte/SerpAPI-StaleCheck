import type { CheckStatus, CheckSummary, Report } from './types'
const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001'

let cachedToken: { value: string; expiresAt: number } | null = null
let tokenRequest: Promise<string> | null = null
let historyRequest: Promise<CheckSummary[]> | null = null

function tokenExpiresAt(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return payload.exp ? payload.exp * 1000 : Date.now() + 60_000
  } catch {
    return Date.now() + 60_000
  }
}

async function requestToken() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch('/api/auth/token', { cache: 'no-store' })
      const result = response.ok ? await response.json() as { token?: string } : {}
      if (result.token) {
        cachedToken = { value: result.token, expiresAt: tokenExpiresAt(result.token) }
        return result.token
      }
    } catch {
      // Retry one transient auth proxy failure before treating the session as expired.
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error('Your session has expired. Please sign in again.')
}

async function getToken() {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 30_000) return cachedToken.value
  if (!tokenRequest) tokenRequest = requestToken().finally(() => { tokenRequest = null })
  return tokenRequest
}

async function authenticatedFetch(path: string, init?: RequestInit) {
  const send = async (token: string) => fetch(`${base}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  })
  let response = await send(await getToken())
  if (response.status === 401) {
    cachedToken = null
    response = await send(await getToken())
  }
  return response
}

async function responseError(response: Response, fallback: string) {
  try {
    const result = await response.json() as { detail?: string }
    return new Error(result.detail || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function getCheckStatus(id: string): Promise<CheckStatus> {
  const response = await authenticatedFetch(`/api/checks/${id}`); if (!response.ok) throw new Error('Could not load check status'); return response.json()
}
export async function getReport(id: string): Promise<Report> { const response = await authenticatedFetch(`/api/checks/${id}/report`); if (!response.ok) throw new Error('Could not load report'); return response.json() }
export async function createCheck(form: FormData) { const response = await authenticatedFetch('/api/checks', { method: 'POST', body: form }); if (!response.ok) throw await responseError(response, 'Could not start check'); return response.json() as Promise<{ check_id: string }> }
export async function listChecks(): Promise<CheckSummary[]> {
  if (!historyRequest) {
    historyRequest = authenticatedFetch('/api/checks')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load check history')
        return response.json() as Promise<CheckSummary[]>
      })
      .finally(() => { historyRequest = null })
  }
  return historyRequest
}
