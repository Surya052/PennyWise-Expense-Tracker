export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const value = (body as { message: unknown }).message
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.map(String).join(', ')
  }
  return fallback
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  bump(1)
  try {
    const headers = new Headers(init?.headers)
    const isForm = init?.body instanceof FormData
    if (!isForm && !headers.has('Content-Type') && init?.body) {
      headers.set('Content-Type', 'application/json')
    }
    const res = await fetch(`/api${path}`, {
      ...init,
      credentials: 'include',
      headers,
    })
    const text = await res.text()
    let body: unknown = null
    if (text) {
      try {
        body = JSON.parse(text) as unknown
      } catch {
        body = text
      }
    }
    if (!res.ok) {
      throw new ApiError(extractMessage(body, res.statusText || 'Request failed'), res.status)
    }
    return body as T
  } finally {
    bump(-1)
  }
}

export async function apiBlob(path: string): Promise<Blob> {
  bump(1)
  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' })
    if (!res.ok) {
      const text = await res.text()
      let body: unknown = null
      try {
        body = JSON.parse(text) as unknown
      } catch {
        body = text
      }
      throw new ApiError(extractMessage(body, res.statusText), res.status)
    }
    return res.blob()
  } finally {
    bump(-1)
  }
}

let busy = 0
const listeners = new Set<(count: number) => void>()

function bump(delta: number) {
  busy = Math.max(0, busy + delta)
  listeners.forEach((listener) => listener(busy))
}

export function subscribeBusy(listener: (count: number) => void) {
  listeners.add(listener)
  listener(busy)
  return () => listeners.delete(listener)
}
