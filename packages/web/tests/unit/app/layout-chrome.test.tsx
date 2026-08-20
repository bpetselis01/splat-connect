import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicFooter } from '@/components/public-footer'

// @/app/layout pulls in AppShell -> lib/capabilities -> lib/api-client, which
// imports the 'server-only' package. That package throws unconditionally
// unless a bundler applies the react-server condition (which vitest does
// not), so it must be mocked here exactly as tests/unit/lib/capabilities.test.ts
// already does — this is test-environment plumbing, not a change to what's
// under test.
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))

// next/font/google's real export is transformed by Next's build-time SWC
// loader; a raw Node/vitest import gets `{}`, so the module-level `Nunito(...)`
// call in the layout throws "Nunito is not a function" before any test body
// runs. Same category of test-environment plumbing as the mock above — no
// change to the layout itself.
vi.mock('next/font/google', () => ({
  Nunito: () => ({ variable: '--font-nunito', className: '' }),
  IBM_Plex_Mono: () => ({ variable: '--font-plex-mono', className: '' }),
}))

/**
 * The layout itself is an async server component that reads headers() and awaits
 * AppShell, which jsdom cannot render. So the contract under test is the rule the
 * layout implements: bare routes get no chrome, public routes get the top bar and
 * the footer. isBare() is exported from the layout for exactly this reason.
 *
 * That the public chrome is ONE bar and not two is a rendered-page property, so
 * it is asserted in tests/e2e/public/navigation.spec.ts instead.
 */
import { isBare } from '@/app/layout'

describe('layout chrome rules', () => {
  it('treats auth and onboarding routes as bare', () => {
    expect(isBare('/login')).toBe(true)
    expect(isBare('/signup')).toBe(true)
    expect(isBare('/auth/confirmed')).toBe(true)
    expect(isBare('/onboarding/contributor-terms')).toBe(true)
  })

  it('treats public routes as chromed', () => {
    expect(isBare('/')).toBe(false)
    expect(isBare('/learn/switch-types')).toBe(false)
    expect(isBare('/about')).toBe(false)
  })

  it('does not treat a route merely containing "login" as bare', () => {
    expect(isBare('/learn/logins')).toBe(false)
  })

  it('renders the sitemap footer', () => {
    render(<PublicFooter />)
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toBeInTheDocument()
  })
})
