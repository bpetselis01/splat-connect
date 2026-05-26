'use client'

import { createClient } from '@/lib/supabase/client'

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function requestFormData<T>(method: string, path: string, formData: FormData): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })
  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const browserApiClient = {
  get:          <T>(path: string)                     => request<T>('GET',  path),
  post:         <T>(path: string, body: unknown)       => request<T>('POST', path, body),
  patch:        <T>(path: string, body: unknown)       => request<T>('PATCH', path, body),
  delete:       <T>(path: string)                     => request<T>('DELETE', path),
  postFormData: <T>(path: string, formData: FormData) => requestFormData<T>('POST', path, formData),
}
