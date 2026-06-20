import type { Paywall } from './types'

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export const USER_TOKEN_KEY = 'sbc.token'
export const USER_KEY = 'sbc.user'
export const GUEST_TOKEN_KEY = 'sbc.guestToken'
export const GUEST_NAME_KEY = 'sbc.guestName'
export const SSO_STATE_KEY = 'sbc.ssoState'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Thrown when the backend returns a 403 paywall denial (reason: subscription_required). */
export class PaywallApiError extends ApiError {
  constructor(public readonly paywall: Paywall, message: string) {
    super(403, message)
    this.name = 'PaywallApiError'
  }
}

function normaliseMessage(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map(String).join('. ')
  return String(raw)
}

function createApi(getToken: () => string | null) {
  async function request<T>(method: string, path: string, body?: unknown, multipart = false): Promise<T> {
    const headers: Record<string, string> = multipart ? {} : { 'Content-Type': 'application/json' }
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : multipart ? (body as FormData) : JSON.stringify(body),
    })

    const text = await res.text()
    let data: unknown
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (!res.ok) {
      if (res.status === 403 && typeof data === 'object' && data !== null) {
        const d = data as Record<string, unknown>
        if (d.reason === 'subscription_required' && d.paywall) {
          throw new PaywallApiError(
            d.paywall as Paywall,
            normaliseMessage(d.message) || 'Abonnement requis',
          )
        }
      }
      const msg =
        (typeof data === 'object' && data !== null && 'message' in data
          ? normaliseMessage((data as { message: unknown }).message)
          : null) ?? `${res.status} ${res.statusText}`
      throw new ApiError(res.status, msg)
    }
    return data as T
  }

  function upload<T>(path: string, file: File, field = 'file'): Promise<T> {
    const fd = new FormData()
    fd.append(field, file)
    return request<T>('POST', path, fd, true)
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
    del: <T>(path: string) => request<T>('DELETE', path),
    upload,
  }
}

/** Unauthenticated — for public endpoints and /auth/login, /auth/sso-callback. */
export const authApi = createApi(() => null)
/** Requests authenticated as the logged-in user. */
export const userApi = createApi(() => localStorage.getItem(USER_TOKEN_KEY))
/** Requests authenticated as the guest token returned by /guest. */
export const guestApi = createApi(() => localStorage.getItem(GUEST_TOKEN_KEY))
