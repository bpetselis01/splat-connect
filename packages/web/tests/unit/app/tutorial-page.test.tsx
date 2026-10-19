import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import TutorialPage from '@/app/tutorials/[id]/page'

const { notFound, getSavedIds, getCapabilities, getMyChildren, apiGet } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  getSavedIds: vi.fn(),
  getCapabilities: vi.fn(),
  getMyChildren: vi.fn(),
  apiGet: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  notFound,
  usePathname: () => '/tutorials/t1',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/lib/saves', () => ({ getSavedIds }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities }))
vi.mock('@/lib/my-children', () => ({ getMyChildren }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: apiGet } }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn(), delete: vi.fn() } }))
vi.mock('@/components/toast', () => ({ useToast: () => vi.fn() }))

const guide = {
  id: 't1', title: 'Bubble Machine', description: 'Blows bubbles on a press.', difficulty: 'easy', kind: 'toy_adaptation',
  status: 'approved', safety_declared_at: null, build_minutes: 30, tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null,
  rejection_note: null, created_at: '', updated_at: '', reviewed_at: null, reviewed_by: null, reviewed_for_org_id: null,
  parts: [], tools: [], stl_files: [], tutorial_recommendations: [], tutorial_contributors: [], thanks_count: 3,
  helps_with: ['communicating'], access: ['press'], one_hand: false, press_force: [], enjoys: [], device_types: [],
}
const note = { id: 'n1', step_position: null, author_id: 'p', author_name: 'Priya', body: 'Use two zip ties.', photo_url: null, photo_caption: null, pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z' }

function serve(routes: Record<string, { ok: boolean; body?: unknown }>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const hit = routes[String(url).replace(/^.*?(\/api\/)/, '/api/')]
    return hit ? { ok: hit.ok, json: async () => hit.body } : { ok: false, json: async () => ({}) }
  }))
}
const open = { '/api/public/tutorials/t1': { ok: true, body: guide }, '/api/public/tutorials/t1/notes': { ok: true, body: [note] } }
const mount = async () => render(await TutorialPage({ params: Promise.resolve({ id: 't1' }) }))

beforeEach(() => {
  vi.clearAllMocks()
  serve(open)
  getSavedIds.mockResolvedValue(null)
  getCapabilities.mockResolvedValue(null)
  getMyChildren.mockResolvedValue([])
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('guide page', () => {
  it('WT01 renders the published guide, and answers an unpublished or unknown id with the 404 page', async () => {
    await mount()
    expect(screen.getByRole('heading', { name: 'Bubble Machine' })).toBeInTheDocument()
    expect(screen.getByText('Blows bubbles on a press.')).toBeInTheDocument()

    cleanup()
    serve({ '/api/public/tutorials/t1': { ok: false } })
    await expect(mount()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('WT02 the breadcrumb leads back to the library and names the guide as the current page', async () => {
    await mount()
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(trail.querySelector('a')).toHaveAttribute('href', '/library')
    expect(trail.querySelector('[aria-current="page"]')).toHaveTextContent('Bubble Machine')
  })

  it('a signed-out visitor gets Share alone: no Save, no Say thanks, no Mark this build done', async () => {
    await mount()
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Say thanks/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /build done/ })).toBeNull()
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('WT08 WT09 WT10 a signed-in member gets Save, Say thanks with the count so far, and Mark this build done', async () => {
    getSavedIds.mockResolvedValue({ tutorials: [], toys: [], challenges: [] })
    getCapabilities.mockResolvedValue({ isAdmin: false })
    apiGet.mockResolvedValue({ thanked: false, own: false })
    await mount()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Say thanks. 3 thanks so far' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Mark this build done' })).toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledWith('/api/tutorials/t1/thanks')
  })

  it('WT09 shows an author their own count read only, and a member who already thanked a disabled Thanked', async () => {
    getSavedIds.mockResolvedValue({ tutorials: ['t1'], toys: [], challenges: [] })
    getCapabilities.mockResolvedValue({ isAdmin: false })
    apiGet.mockResolvedValue({ thanked: false, own: true })
    await mount()
    expect(screen.getByText('3 thanks')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Say thanks/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')

    cleanup()
    apiGet.mockResolvedValue({ thanked: true, own: false })
    await mount()
    expect(screen.getByRole('button', { name: 'Thanked. 3 thanks' })).toBeDisabled()
  })

  it('WT11 draws the pin controls for the guide author and for an admin, and for nobody else', async () => {
    getSavedIds.mockResolvedValue({ tutorials: [], toys: [], challenges: [] })
    getCapabilities.mockResolvedValue({ isAdmin: false })
    apiGet.mockResolvedValue({ thanked: false, own: false })
    await mount()
    expect(screen.queryByRole('button', { name: 'Pin as revision' })).toBeNull()

    cleanup()
    apiGet.mockResolvedValue({ thanked: false, own: true })
    await mount()
    expect(screen.getByRole('button', { name: 'Pin as revision' })).toBeInTheDocument()

    cleanup()
    getCapabilities.mockResolvedValue({ isAdmin: true })
    apiGet.mockResolvedValue({ thanked: false, own: false })
    await mount()
    expect(screen.getByRole('button', { name: 'Pin as revision' })).toBeInTheDocument()
  })

  it('WT12 draws "Suits your child" for a signed-in member whose child shares an answer, and not for one whose child does not', async () => {
    getSavedIds.mockResolvedValue({ tutorials: [], toys: [], challenges: [] })
    getCapabilities.mockResolvedValue({ isAdmin: false })
    apiGet.mockResolvedValue({ thanked: false, own: false })
    getMyChildren.mockResolvedValue([{ helps_with: ['communicating'], access: [], one_hand: false, press_force: [], enjoys: [] }])
    await mount()
    expect(screen.getByTestId('fit-callout')).toHaveTextContent('Suits your child')

    cleanup()
    getMyChildren.mockResolvedValue([{ helps_with: ['walking'], access: [], one_hand: false, press_force: [], enjoys: [] }])
    await mount()
    expect(screen.queryByTestId('fit-callout')).toBeNull()
  })
})
