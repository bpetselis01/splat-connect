import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PUBLIC_NAV, SCAFFOLD_KEYS } from '@/lib/public-nav'

describe('design challenges nav state', () => {
  it('is live, so the section no longer advertises a placeholder', () => {
    const getInvolved = PUBLIC_NAV.find((s) => s.href === '/get-involved')!
    const challenges = getInvolved.children.find((c) => c.href === '/get-involved/design-challenges')!
    expect(challenges.state).toBe('live')
    expect(challenges.featureKey).toBeUndefined()
  })

  it('drops design-challenges from the notify allowlist', () => {
    expect(SCAFFOLD_KEYS).not.toContain('design-challenges')
  })
})

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const jsonResponse = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) })

// The page now asks which challenges this visitor saved. That reaches the
// server-only API client, which a jsdom test cannot import — and this file is
// about the listing, not about saves. null is the signed-out answer, so the
// islands render unfilled and route to /signup.
vi.mock('@/lib/saves', () => ({ getSavedIds: async () => null }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/get-involved/design-challenges',
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const idea = (id: string, status: 'challenge' | 'graduated') => ({
  id,
  title: `Idea ${id}`,
  summary: `Summary for ${id}`,
  status,
  contact_prefs: [],
  created_at: '',
})

describe('design challenges listing page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders a card per challenge, with a maker chip on open ones and a write-up badge on graduated ones', async () => {
    fetchMock.mockResolvedValue(jsonResponse([idea('a', 'challenge'), idea('b', 'graduated')]))
    const { default: Page } = await import('@/app/get-involved/design-challenges/page')
    render(await Page())

    expect(screen.getByText('Idea a')).toBeInTheDocument()
    expect(screen.getByText('Idea b')).toBeInTheDocument()
    expect(screen.getByText(/looking for makers/i)).toBeInTheDocument()
    expect(screen.getByText('Being written up')).toBeInTheDocument()
  })

  it('explains what a challenge is and points at submitting one when none are open', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    const { default: Page } = await import('@/app/get-involved/design-challenges/page')
    render(await Page())

    expect(screen.getByText(/no challenges are open yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /submit an idea/i })).toHaveAttribute(
      'href',
      '/get-involved/submit-an-idea'
    )
  })

  it('renders an honest error state instead of throwing when the API 500s', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'boom' }) })
    const { default: Page } = await import('@/app/get-involved/design-challenges/page')
    render(await Page())

    expect(screen.getByText(/could not load design challenges/i)).toBeInTheDocument()
    expect(screen.queryByText(/no challenges are open yet/i)).not.toBeInTheDocument()
  })
})
