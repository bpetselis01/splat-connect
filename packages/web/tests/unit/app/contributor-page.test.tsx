import { render, screen, within, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ContributorPage from '@/app/contributors/[id]/page'

const { notFound, getCapabilities } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  getCapabilities: vi.fn(),
}))
vi.mock('next/navigation', () => ({ notFound, usePathname: () => '/contributors/c1', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

const guide = (id: string, title: string) => ({
  id, title, difficulty: 'easy', kind: 'toy_adaptation', status: 'approved', build_minutes: 30, description: null,
  photo_urls: [], toy_photo_url: null, created_at: '2026-03-01T00:00:00Z', reviewed_at: '2026-03-02T00:00:00Z', thanks_count: 2,
})
const toy = (id: string, name: string) => ({ id, name, created_at: '2026-04-01T00:00:00Z', status: 'published', photo_urls: [], cover_photo_url: null })
const profile = {
  id: 'c1', name: 'Priya Shah', bio: 'I adapt toys.', created_at: '2026-01-01T00:00:00Z',
  tutorials: [guide('g1', 'Switch drum'), guide('g2', 'Light bear')], toysShared: [toy('t1', 'Pop-up pals')], toysDelivered: [],
  featured: guide('g1', 'Switch drum'), thanks: 3, builds: 5, badges: [],
}

function serve(res: { ok: boolean; body?: unknown }) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: res.ok, json: async () => res.body })))
}
const mount = async () => render(await ContributorPage({ params: Promise.resolve({ id: 'c1' }) }))

beforeEach(() => {
  vi.clearAllMocks()
  serve({ ok: true, body: profile })
  getCapabilities.mockResolvedValue(null)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('contributor profile page', () => {
  it('WP01 shows the name, bio, the three stats and the thanks and build counts, and 404s without a public contribution', async () => {
    await mount()
    expect(screen.getByRole('heading', { level: 1, name: 'Priya Shah' })).toBeInTheDocument()
    expect(screen.getByText('I adapt toys.')).toBeInTheDocument()
    expect(within(screen.getByTestId('contributor-stat-tutorials')).getByText('2')).toBeInTheDocument()
    expect(within(screen.getByTestId('contributor-stat-toys-shared')).getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5 builds logged')).toBeInTheDocument()
    expect(screen.getByText(/3 families built one of Priya's guides and said thanks/)).toBeInTheDocument()

    cleanup()
    serve({ ok: false })
    await expect(mount()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('WP02 the breadcrumb leads to Impact, the anchors to the sections, and the guide, toy and activity rows to their pages', async () => {
    await mount()
    expect(screen.getByRole('link', { name: 'Impact' })).toHaveAttribute('href', '/impact')
    const anchors = within(screen.getByRole('navigation', { name: 'On this page' })).getAllByRole('link')
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual(['#ctb-about', '#ctb-featured', '#ctb-guides', '#ctb-thanks', '#ctb-toys', '#ctb-activity'])
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/tutorials/g1', '/tutorials/g2', '/toy-library/t1']))
    const activity = within(document.getElementById('ctb-activity')!).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(activity).toEqual(expect.arrayContaining(['/tutorials/g1', '/toy-library/t1']))
  })

  it('WP03 "Ask Priya to build a guide" goes to the request form for a Member and through sign up for a visitor', async () => {
    getCapabilities.mockResolvedValue({ profile: { id: 'me' } })
    await mount()
    expect(screen.getByRole('link', { name: 'Ask Priya to build a guide' })).toHaveAttribute('href', '/get-involved/requests/new?maker=c1')

    cleanup()
    getCapabilities.mockResolvedValue(null)
    await mount()
    expect(screen.getByRole('link', { name: 'Ask Priya to build a guide' })).toHaveAttribute(
      'href',
      '/signup?next=%2Fget-involved%2Frequests%2Fnew%3Fmaker%3Dc1&reason=build'
    )
  })

  it('offers thanks to everyone but the person themselves', async () => {
    getCapabilities.mockResolvedValue({ profile: { id: 'me' } })
    await mount()
    expect(screen.getByRole('button', { name: 'Say thanks to Priya' })).toBeInTheDocument()

    cleanup()
    getCapabilities.mockResolvedValue({ profile: { id: 'c1' } })
    await mount()
    expect(screen.queryByRole('button', { name: /Say thanks/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /to build a guide/ })).toBeNull()
  })
})
