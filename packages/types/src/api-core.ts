/**
 * Shared request core for every API client: web's api-client.ts (server) and
 * browser-api-client.ts (browser), and mobile's lib/api-client.ts. Deliberately
 * has neither 'server-only' nor 'use client' — each client declares its own
 * boundary and differs only in how it obtains the token and base URL. Before
 * this existed the copies drifted — web's server one lost the error-detail and
 * empty-body fixes, and mobile's never had `status`.
 */

/**
 * Thrown by every request below. `status` is additive — every existing
 * `catch (err) { err instanceof Error ? err.message : ... }` call site still
 * works unchanged — but callers that need to branch on the outcome (a 409
 * meaning "already done" vs. a real failure) can check `err.status`
 * numerically instead of pattern-matching the message, which breaks the
 * moment describeFailure's wording changes.
 */
export type ApiError = Error & { status: number; code?: string }

export function isApiError(err: unknown): err is ApiError {
  return err instanceof Error && typeof (err as { status?: unknown }).status === 'number'
}

/**
 * The API's gate on contributor terms answers 403 `{ error: 'terms_required' }`.
 * The code is read from the JSON body once, in throwFailure; a 403 whose body
 * is not JSON, or says anything else, is a plain forbidden.
 */
export function isTermsRequired(err: unknown): boolean {
  return isApiError(err) && err.status === 403 && err.code === 'terms_required'
}

/** The API's own `error` sentence out of a thrown request, when it sent one. */
export function apiErrorDetail(err: unknown): string | null {
  return err instanceof Error ? (/failed with status \d+: (.+)$/.exec(err.message)?.[1] ?? null) : null
}

/**
 * True when the request never got an answer: fetch rejects with a TypeError
 * ("Network request failed" on React Native, "Failed to fetch" / "Load failed"
 * on the web) when offline, and an AbortError / TimeoutError when cancelled.
 * Going offline is expected, so callers should not log these as errors.
 */
export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error) || isApiError(err)) return false // the API answered
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true
  return /network request failed|failed to fetch|network error|load failed|timed out|timeout/i.test(err.message)
}

/**
 * The API writes its 4xx bodies for humans — "Incorrect code", "Your
 * organisation needs a pickup address before you can accept requests" — so
 * show that sentence rather than a generic apology. 5xx keeps the fallback: a
 * raw Postgres error is not copy.
 */
export function apiMessage(err: unknown, fallback: string): string {
  if (isTermsRequired(err)) return 'Accept the contributor terms to continue'
  const text = err instanceof Error ? err.message : ''
  const match = /failed with status 4\d\d: (.+)$/.exec(text)
  if (match) return match[1]
  // fetch rejects with these when the request never reached the API.
  if (isNetworkError(err)) {
    return "You're offline. Check your connection and try again."
  }
  if (/failed with status 429/.test(text)) return 'Too many tries. Wait a minute and try again.'
  return fallback
}

export function makeApiClient(deps: {
  getToken: () => Promise<string | null>
  // Lazy so the server client re-reads process.env per request (tests set it
  // late) and the browser client keeps its literal NEXT_PUBLIC_* read inlined
  // at its own call site by Next's build.
  baseUrl: () => string
  // Runs once when a write is refused for want of contributor terms; each
  // environment navigates its own way (browser assign, server redirect, mobile push).
  // The error is still thrown after it returns, so a caller never carries on as if it worked.
  onTermsRequired?: () => void | Promise<void>
  // Not RequestCache: that type is DOM-only, and the API's Node tsc compiles
  // this package too. 'no-store' is the only value any client passes.
  cache?: 'no-store'
}) {
  // WHY: Error messages from the API were being lost — you'd see "failed with
  //      status 400" but not the reason why.
  // HOW: Reads the response body for an error field and appends it to the
  //      thrown error so the cause is visible in logs and error messages.
  async function throwFailure(method: string, path: string, res: Response): Promise<never> {
    let code: string | undefined
    try {
      code = ((await res.clone().json()) as { error?: string }).error || undefined
    } catch {}
    const err = new Error(
      `API ${method} ${path} failed with status ${res.status}${code ? `: ${code}` : ''}`
    ) as ApiError
    err.status = res.status
    if (code) err.code = code
    if (isTermsRequired(err)) await deps.onTermsRequired?.()
    throw err
  }

  // WHY: Some API responses have no body (e.g. 204 No Content), which caused
  //      JSON.parse to fail on an empty string and throw an unrelated error.
  async function parseBody<T>(res: Response): Promise<T> {
    const text = await res.text()
    return (text ? JSON.parse(text) : null) as T
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await deps.getToken()
    const res = await fetch(`${deps.baseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(deps.cache ? { cache: deps.cache } : {}),
    })
    if (!res.ok) return throwFailure(method, path, res)
    return parseBody<T>(res)
  }

  async function requestFormData<T>(method: string, path: string, formData: FormData): Promise<T> {
    const token = await deps.getToken()
    const res = await fetch(`${deps.baseUrl()}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      ...(deps.cache ? { cache: deps.cache } : {}),
    })
    if (!res.ok) return throwFailure(method, path, res)
    return parseBody<T>(res)
  }

  return {
    get:          <T>(path: string)                     => request<T>('GET',    path),
    post:         <T>(path: string, body: unknown)       => request<T>('POST',   path, body),
    put:          <T>(path: string, body: unknown)       => request<T>('PUT',    path, body),
    patch:        <T>(path: string, body: unknown)       => request<T>('PATCH',  path, body),
    delete:       <T>(path: string, body?: unknown)     => request<T>('DELETE', path, body),
    postFormData: <T>(path: string, formData: FormData) => requestFormData<T>('POST', path, formData),
  }
}
