import type { PolicyRule } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    let payload: { detail?: string } | undefined
    try {
      payload = await response.json() as { detail?: string }
    } catch {
      payload = undefined
    }
    throw new Error(payload?.detail ?? `Request failed (${response.status})`)
  }

  return response.json() as Promise<T>
}

export async function healthCheck() {
  return apiRequest<{ status: string; service: string }>('/api/health')
}

export async function fetchPolicies() {
  return apiRequest<{ roles: string[]; destinations: string[]; rules: PolicyRule[] }>('/api/policies')
}

export async function updatePolicy(rule: PolicyRule) {
  return apiRequest<PolicyRule>(`/api/policies/${rule.id}`, {
    method: 'PUT',
    body: JSON.stringify({ default_action: rule.default_action }),
  })
}

export async function scanPrompt(text: string, role: string, destination: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return apiRequest<any>('/api/scan', {
    method: 'POST',
    body: JSON.stringify({ text, role, destination }),
  })
}

export async function fetchAuditLogs() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return apiRequest<{ records: any[] }>('/api/audit')
}

export async function runEvaluation() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return apiRequest<any>('/api/evaluate', { method: 'POST' })
}
