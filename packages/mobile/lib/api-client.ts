import { supabase } from './supabase'

// Exported so lib/upload.ts can reuse the exact same session lookup for its
// multipart requests instead of a second copy of this.
export async function getToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function handleResponse<T>(res: Response, method: string, path: string): Promise<T> {
  if (!res.ok) {
    let detail = ''
    try {
      const j = (await res.clone().json()) as { error?: string }
      if (j.error) detail = `: ${j.error}`
    } catch {}
    throw new Error(`API ${method} ${path} failed with status ${res.status}${detail}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  return handleResponse<T>(res, method, path)
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
