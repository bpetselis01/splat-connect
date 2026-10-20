import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const path = vi.hoisted(() => ({ current: '/' }))
const caps = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-pathname': path.current }),
  cookies: async () => ({ get: () => undefined }),
}))
vi.mock('next/navigation', () => ({ usePathname: () => path.current, useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: async () => caps.current }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('next/font/google', () => ({
  Nunito: () => ({ variable: '--font-nunito', className: '' }),
  JetBrains_Mono: () => ({ variable: '--font-jetbrains', className: '' }),
  Baloo_2: () => ({ variable: '--font-baloo', className: '' }),
}))

import RootLayout from '@/app/layout'

async function render(pathname: string, signedIn = false) {
  path.current = pathname
  caps.current = signedIn
    ? { profile: { id: 'u1', name: 'Ada Lovelace' }, unread: { total: 0 }, isAdmin: false, ledOrgs: [], exchangeActions: 0 }
    : null
  return renderToStaticMarkup(await RootLayout({ children: <p>page body</p> }))
}

describe('root layout shell', () => {
  beforeEach(() => vi.clearAllMocks())

  it('WC11 gives every page a skip link that targets the main landmark', async () => {
    const html = await render('/about')
    expect(html).toContain('<a href="#main"')
    expect(html).toContain('Skip to main content')
    expect(html).toMatch(/<main id="main" tabindex="-1"[^>]*><p>page body<\/p>/)
  })

  it.each(['/auth/confirmed', '/onboarding/contributor-terms', '/onboarding/child'])(
    'WC10 renders %s bare: main and skip link, no header, footer or dock',
    async (pathname) => {
      const html = await render(pathname, true)
      expect(html).toContain('Skip to main content')
      expect(html).toContain('<main id="main"')
      expect(html).not.toContain('<header')
      expect(html).not.toContain('<footer')
      expect(html).not.toContain('Back to My SPLAT')
    }
  )

  it('WC10 renders /login with the header and footer', async () => {
    const html = await render('/login')
    expect(html).toContain('<header')
    expect(html).toContain('<footer')
  })

  it('WC12 shows the Back to My SPLAT dock only when signed in', async () => {
    expect(await render('/about', true)).toContain('Back to My SPLAT')
    expect(await render('/about', false)).not.toContain('Back to My SPLAT')
  })
})
