import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeleteAccountForm, openSummary } from '@/components/delete-account-form'

const signInWithOtp = vi.fn()
const verifyOtp = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOtp, verifyOtp, signOut: vi.fn() } }),
}))
const del = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { delete: (...a: unknown[]) => del(...a) } }))

const preview = { open: [{ id: 't', type: 'build' }], childProfiles: 1, publishedGuides: 2, soleLedOrgs: [] }

beforeEach(() => vi.clearAllMocks())

describe('openSummary', () => {
  it('counts each kind in words', () => {
    expect(openSummary([{ id: 'a', type: 'build' }, { id: 'b', type: 'build' }, { id: 'c', type: 'donation' }])).toBe(
      '2 builds, 1 exchange'
    )
  })
})

describe('DeleteAccountForm', () => {
  it('asks for DELETE, then the code, then deletes with the keep-name choice', async () => {
    signInWithOtp.mockResolvedValue({ error: null })
    verifyOtp.mockResolvedValue({ error: null })
    del.mockResolvedValue(undefined)
    render(<DeleteAccountForm preview={preview} email="sam@example.com" />)

    expect(screen.getByText('1 build in progress')).toBeTruthy()
    const send = screen.getByRole('button', { name: 'Email me a code' })
    expect(send).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByLabelText('Keep my name on my published guides'))
    fireEvent.change(screen.getByLabelText('Type DELETE to continue'), { target: { value: 'DELETE' } })
    fireEvent.click(send)
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledWith({ email: 'sam@example.com', options: { shouldCreateUser: false } }))

    fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect(await screen.findByText('Your account is deleted')).toBeTruthy()
    expect(del).toHaveBeenCalledWith('/api/me', { confirm: 'DELETE', keepCredit: true })
  })

  it('stops a sole organisation leader', () => {
    render(<DeleteAccountForm preview={{ ...preview, soleLedOrgs: [{ id: 'o', name: 'Northbank' }] }} email="s@e.com" />)
    expect(screen.getByRole('alert').textContent).toContain('only leader of Northbank')
    expect(screen.queryByLabelText('Type DELETE to continue')).toBeNull()
  })
})
