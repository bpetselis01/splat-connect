import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ToyLibraryDetailPage from '@/app/toy-library/[id]/page'

const caps = vi.hoisted(() => ({ current: null as unknown }))
const saved = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: async () => caps.current }))
vi.mock('@/lib/saves', () => ({ getSavedIds: async () => saved.current }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn().mockResolvedValue([]) } }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/toy-library/toy-1',
}))
vi.mock('@/components/toast', () => ({ useToast: () => vi.fn() }))

const toy = {
  id: 'toy-1', owner_id: 'holder-1', owner_org_id: null, quantity: 1, name: 'Fire truck', description: 'Siren works with one press.',
  condition: 8, switch_adapted: true, switch_photo_url: null, status: 'published', offer_type: 'both', paused_at: null,
  photo_urls: ['https://test.supabase.co/storage/v1/object/public/photos/a.jpg'], cover_photo_url: 'https://test.supabase.co/storage/v1/object/public/photos/a.jpg',
  created_at: new Date().toISOString(), profiles: { name: 'Dana' }, organizations: null, holder_given: 3, picks: [], facts: null, guide: null,
}

function serve(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok, json: async () => (String(url).endsWith('/toy-1') ? body : [body]) })))
}
const page = async () => render(await ToyLibraryDetailPage({ params: Promise.resolve({ id: 'toy-1' }) }))
const member = (id: string) => ({ profile: { id, name: 'Sam' }, ledOrgs: [] })

describe('/toy-library/[id]', () => {
  beforeEach(() => {
    caps.current = null
    saved.current = null
    serve(toy)
  })

  it('WY05 WY25 shows the toy, its holder, the notes, the sign-in gate and a Save to a guest', async () => {
    await page()
    expect(screen.getByRole('heading', { level: 1, name: 'Fire truck' })).toBeInTheDocument()
    expect(screen.getByText('Held by Dana')).toBeInTheDocument()
    expect(screen.getByText('Siren works with one press.')).toBeInTheDocument()
    expect(screen.getByText('3 toys given · 1 toy listed · a family')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in to unlock' })).toHaveAttribute('href', '/login?next=%2Ftoy-library%2Ftoy-1')
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('WY05 is not found for a toy the API does not serve', async () => {
    serve(null, false)
    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('WY06 gives a signed-in member the two ways in, each carrying its mode', async () => {
    caps.current = member('viewer-1')
    saved.current = { toys: [] }
    await page()
    expect(screen.getByRole('link', { name: 'Ask to collect it' })).toHaveAttribute('href', '/toy-library/toy-1/request?mode=donation')
    expect(screen.getByRole('link', { name: 'Offer a swap' })).toHaveAttribute('href', '/toy-library/toy-1/request?mode=exchange')
  })

  it('WY07 gives a guest the sign-in form of both buttons, returning to the request', async () => {
    await page()
    expect(screen.getByRole('link', { name: 'Sign in to ask for it' })).toHaveAttribute(
      'href',
      `/login?next=${encodeURIComponent('/toy-library/toy-1/request?mode=donation')}`
    )
  })

  it('WY08 offers a member the labelled Save, filled when the toy is already saved', async () => {
    caps.current = member('viewer-1')
    saved.current = { toys: ['toy-1'] }
    await page()
    expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('WY09 offers a member the report link and hides it from the holder', async () => {
    caps.current = member('viewer-1')
    saved.current = { toys: [] }
    const { unmount } = await page()
    expect(screen.getByRole('button', { name: /Report this listing/ })).toBeInTheDocument()
    unmount()

    caps.current = member('holder-1')
    await page()
    expect(screen.queryByRole('button', { name: /Report this listing/ })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Ask to collect it' })).toBeNull()
  })
})
