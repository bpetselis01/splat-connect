import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeleteAccountForm, openSummary } from '@/components/delete-account-form'

const signInWithOtp = vi.fn()
const verifyOtp = vi.fn()
const signOut = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOtp, verifyOtp, signOut } }),
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
  it('WD19 asks for DELETE, then the code, then deletes with the keep-name choice', async () => {
    signInWithOtp.mockResolvedValue({ error: null })
    verifyOtp.mockResolvedValue({ error: null })
    del.mockResolvedValue({ emailed: true })
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
    expect(screen.getByText('We emailed a confirmation to sam@example.com.')).toBeTruthy()
    expect(del).toHaveBeenCalledWith('/api/me', { confirm: 'DELETE', keepCredit: true })
  })

  it('WD21 stops a sole organisation leader', () => {
    render(<DeleteAccountForm preview={{ ...preview, soleLedOrgs: [{ id: 'o', name: 'Northbank' }] }} email="s@e.com" />)
    expect(screen.getByRole('alert').textContent).toContain('only leader of Northbank')
    expect(screen.queryByLabelText('Type DELETE to continue')).toBeNull()
    expect(screen.getByRole('link', { name: 'Manage leaders' }).getAttribute('href')).toBe('/dashboard/organisation/profile#leaders')
  })

  it('WD18 enables Email me a code only for the exact word DELETE, then asks for the six digits', async () => {
    signInWithOtp.mockResolvedValue({ error: null })
    render(<DeleteAccountForm preview={preview} email="sam@example.com" />)
    const send = screen.getByRole('button', { name: 'Email me a code' })
    fireEvent.change(screen.getByLabelText('Type DELETE to continue'), { target: { value: 'delete' } })
    expect(send).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Type DELETE to continue'), { target: { value: ' DELETE ' } })
    expect(send).toHaveProperty('disabled', false)
    fireEvent.click(send)
    expect(await screen.findByText('sam@example.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete my account' })).toHaveProperty('disabled', true)
  })

  it('WD18 shows the mail error and stays on the first step when the code cannot be sent', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } })
    render(<DeleteAccountForm preview={preview} email="sam@example.com" />)
    fireEvent.change(screen.getByLabelText('Type DELETE to continue'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Email rate limit exceeded')
    expect(screen.queryByLabelText('6-digit code')).toBeNull()
  })

  it('WD19 says the code did not work, clears it and deletes nothing when the code is wrong', async () => {
    signInWithOtp.mockResolvedValue({ error: null })
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } })
    render(<DeleteAccountForm preview={preview} email="sam@example.com" />)
    fireEvent.change(screen.getByLabelText('Type DELETE to continue'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
    fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect((await screen.findByRole('alert')).textContent).toBe("That code didn't work. Check the latest email, or send a new one.")
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'sam@example.com', token: '000000', type: 'email' })
    expect(del).not.toHaveBeenCalled()
    expect(screen.getByLabelText('6-digit code')).toHaveProperty('value', '')
  })

  it('WD19 keeps the account and says so when the API refuses after a good code', async () => {
    signInWithOtp.mockResolvedValue({ error: null })
    verifyOtp.mockResolvedValue({ error: null })
    del.mockRejectedValue(new Error('500'))
    render(<DeleteAccountForm preview={preview} email="sam@example.com" />)
    fireEvent.change(screen.getByLabelText('Type DELETE to continue'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
    fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Your account was not deleted. Try again in a moment.')
    expect(screen.queryByText('Your account is deleted')).toBeNull()
  })

  it('WD20 signs out and goes to the home page from Done', async () => {
    signInWithOtp.mockResolvedValue({ error: null })
    verifyOtp.mockResolvedValue({ error: null })
    del.mockResolvedValue({ emailed: false })
    signOut.mockResolvedValue({ error: null })
    const location = { href: '/dashboard/profile/delete' }
    vi.stubGlobal('location', location)
    render(<DeleteAccountForm preview={preview} email="sam@example.com" />)
    fireEvent.change(screen.getByLabelText('Type DELETE to continue'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
    fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    fireEvent.click(await screen.findByTestId('deleted-done'))
    await waitFor(() => expect(location.href).toBe('/'))
    expect(signOut).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('WD21 lists what is deleted, what stays and what open work is cancelled', () => {
    render(<DeleteAccountForm preview={{ open: [{ id: 'a', type: 'print' }, { id: 'b', type: 'donation' }], childProfiles: 2, publishedGuides: 3, soleLedOrgs: [] }} email="s@e.com" />)
    expect(screen.getByText('1 print job, 1 exchange in progress')).toBeTruthy()
    expect(screen.getByText('2 child profiles')).toBeTruthy()
    expect(screen.getByText('3 published guides')).toBeTruthy()
    expect(screen.getByText('Keep my name on my published guides')).toBeTruthy()
  })
})
