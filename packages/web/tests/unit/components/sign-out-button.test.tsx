import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignOutButton } from '@/components/sign-out-button'

const signOut = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut } }) }))

describe('SignOutButton', () => {
  it('WD07 signs out of Supabase, then goes to the home page', async () => {
    signOut.mockResolvedValue({ error: null })
    const location = { href: '/dashboard/profile' }
    vi.stubGlobal('location', location)
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(location.href).toBe('/'))
    expect(signOut).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
