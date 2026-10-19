import { render, screen, within, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import HomePage from '@/app/page'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
}))

const guide = (id: string, title: string) => ({
  id, title, difficulty: 'easy', kind: 'toy_adaptation', status: 'approved', build_minutes: 30,
  description: null, tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, rejection_note: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', reviewed_at: null,
  reviewed_by: null, reviewed_for_org_id: null, safety_declared_at: null,
})
const toy = (id: string, name: string) => ({
  id, name, condition: 8, status: 'published', switch_adapted: true, quantity: 1, owner_id: 'o',
  owner_org_id: null, photo_urls: [], cover_photo_url: null,
})
const impact = {
  totals: { tutorials: 12, toysShared: 9, toysDelivered: 7, contributors: 4, organisations: 3 },
  recent: [], contributors: [], organisations: [], deliveriesByMonth: [],
}

function serve(routes: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = String(url).replace(/^.*?(\/api\/)/, '/api/')
    return path in routes
      ? { ok: true, json: async () => routes[path] }
      : { ok: false, json: async () => ({}) }
  }))
}

const full = {
  '/api/public/tutorials': [guide('g-1', 'Switch drum'), guide('g-2', 'Light-up bear'), guide('g-3', 'Third guide')],
  '/api/public/toys': [toy('t-1', 'Pop-up pals'), toy('t-2', 'Rainbow cat')],
  '/api/public/impact': impact,
  '/api/public/content/home': { hero: null, numbers: null, scenes: null },
}

async function renderHome() {
  render(await HomePage())
}

beforeEach(() => {
  serve(full)
  // jsdom has no matchMedia; "reduced" makes CountUp and ScrollWorld settle at once.
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('home page', () => {
  it('WH01 the hero buttons lead to the guides library and the toy library', async () => {
    await renderHome()
    expect(screen.getByRole('link', { name: 'Find a guide' })).toHaveAttribute('href', '/library')
    const second = screen.getAllByRole('link', { name: /toy/i }).find((a) => a.className.includes('btn-hero'))
    expect(second).toHaveAttribute('href', '/toy-library')
  })

  it('WH02 the three doors lead to the hubs, and the first two name the live counts', async () => {
    await renderHome()
    const doors = screen.getByRole('region', { name: 'Where to start' })
    expect(within(doors).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/library', '/toy-library', '/get-involved'])
    expect(within(doors).getByText('Browse 3 guides')).toBeInTheDocument()
    expect(within(doors).getByText('See 2 toys available')).toBeInTheDocument()
  })

  it('WH03 the cost card leads to the printing basics and the plastic card to recycling', async () => {
    await renderHome()
    const costs = screen.getByRole('region', { name: 'What things cost' })
    expect(within(costs).getByRole('link', { name: 'See how printing costs work' })).toHaveAttribute('href', '/printing/basics')
    expect(within(costs).getByRole('link', { name: 'See who takes plastic' })).toHaveAttribute('href', '/get-involved/recycling')
  })

  it('WH04 WH05 Recent guides and Recent toys show two cards each and link on to the hubs and the items', async () => {
    await renderHome()
    const recent = screen.getByRole('region', { name: 'Recently added' })
    const hrefs = within(recent).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/library')
    expect(hrefs).toContain('/toy-library')
    expect(hrefs.filter((h) => h?.startsWith('/tutorials/'))).toEqual(['/tutorials/g-1', '/tutorials/g-2'])
    expect(hrefs.filter((h) => h?.startsWith('/toy-library/'))).toEqual(['/toy-library/t-1', '/toy-library/t-2'])
  })

  it('WH06 the stat chips carry the impact totals, and a failed API degrades to zeros, not an error', async () => {
    await renderHome()
    const chips = within(screen.getByRole('heading', { level: 1 }).closest('section')!)
    expect(chips.getByText('12')).toBeInTheDocument()
    expect(chips.getByText('3')).toBeInTheDocument()
    expect(chips.getByText('7')).toBeInTheDocument()

    cleanup()
    serve({})
    await renderHome()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Where to start' })).getByText('Browse 0 guides')).toBeInTheDocument()
  })
})
