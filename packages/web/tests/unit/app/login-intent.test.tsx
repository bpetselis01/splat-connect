import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/login/page'

// The sign-up tile's one job: where the first sign-in lands (pendingIntent).

let search = new URLSearchParams()
vi.mock('next/navigation', () => ({ useSearchParams: () => search }))

let meta: Record<string, unknown> = {}
const updateUser = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: async () => ({ error: null }),
      getUser: async () => ({ data: { user: { id: 'u1', user_metadata: meta } } }),
      updateUser: (...a: unknown[]) => updateUser(...a),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'contributor' } }) }) }),
    }),
  }),
}))

async function signIn() {
  render(<LoginPage />)
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret1' } })
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
}

describe('login landing by sign-up intent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    search = new URLSearchParams()
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })
  })

  it.each([
    ['family', '/onboarding/child'],
    ['maker', '/dashboard/tutorials'],
  ])('lands a first-time %s on %s, and spends the intent', async (intent, path) => {
    meta = { intent }
    await signIn()
    await waitFor(() => expect(window.location.href).toBe(path))
    expect(updateUser).toHaveBeenCalledWith({ data: { intent_landed: true } })
  })

  it('lands on the dashboard once the intent is spent', async () => {
    meta = { intent: 'family', intent_landed: true }
    await signIn()
    await waitFor(() => expect(window.location.href).toBe('/dashboard'))
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('lets ?next= win, but still spends the intent', async () => {
    meta = { intent: 'maker' }
    search = new URLSearchParams('next=/toy-library')
    await signIn()
    await waitFor(() => expect(window.location.href).toBe('/toy-library'))
    expect(updateUser).toHaveBeenCalled()
  })
})
