import { render, screen, within, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LibraryClient } from '@/app/library/library-client'
import type { Tutorial } from '@splat-connect/types'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => '/library',
}))
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
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn(), delete: vi.fn() } }))
vi.mock('@/components/toast', () => ({ useToast: () => vi.fn() }))

import { browserApiClient } from '@/lib/browser-api-client'

const guide = (id: string, title: string, over: Record<string, unknown> = {}) =>
  ({
    id, title, difficulty: 'easy', kind: 'toy_adaptation', status: 'approved', build_minutes: 40,
    description: null, tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, rejection_note: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', reviewed_at: '2026-01-02T00:00:00Z',
    reviewed_by: null, reviewed_for_org_id: null, safety_declared_at: null, ...over,
  }) as unknown as Tutorial

const quick = guide('q', 'Quick drum', { build_minutes: 20 })
const slow = guide('s', 'Slow robot', { build_minutes: 120, has_stl: true })
const stats = { guides: 2, contributors: 5, organisations: 3 }

function mount(props: Partial<React.ComponentProps<typeof LibraryClient>> = {}) {
  return render(<LibraryClient tutorials={[quick, slow]} stats={stats} savedIds={[]} signedIn={false} {...props} />)
}
const titles = () => screen.getAllByTestId('tutorial-card').map((c) => c.querySelector('.browse-card__title')?.textContent)

beforeEach(() => vi.clearAllMocks())

describe('library client', () => {
  it('WG01 lists every guide it was given with the count, and shows the three hero totals', () => {
    mount()
    expect(titles()).toEqual(expect.arrayContaining(['Quick drum', 'Slow robot']))
    expect(screen.getByText('2 guides')).toBeInTheDocument()
    expect(screen.getByText('reviewed guides').previousElementSibling).toHaveTextContent('2')
    expect(screen.getByText('contributors').previousElementSibling).toHaveTextContent('5')
    expect(screen.getByText('organisations backing').previousElementSibling).toHaveTextContent('3')
  })

  it('WG01 with no guides shows the empty state, and the count falls back to the list it holds', () => {
    mount({ tutorials: [], stats: null })
    expect(screen.getByText('Nothing matches all of those yet')).toBeInTheDocument()
    expect(screen.getByText('0 guides')).toBeInTheDocument()
    expect(screen.queryByText('contributors')).toBeNull()
  })

  it('WG02 ?q= arrives as a removable chip that narrows the grid, and removing it restores the list', () => {
    mount({ initialSearch: 'drum' })
    expect(titles()).toEqual(['Quick drum'])
    fireEvent.click(screen.getByRole('button', { name: /“drum”/ }))
    expect(titles()).toHaveLength(2)
  })

  it('WG03 Quickest puts the shortest build first', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Quickest' }))
    expect(titles()).toEqual(['Quick drum', 'Slow robot'])
    expect(screen.getByRole('button', { name: 'Quickest' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('WG04 Needs printing keeps only guides with STL files, and a second choice in the facet replaces it', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Needs printing' }))
    expect(titles()).toEqual(['Slow robot'])
    expect(screen.getByText('1 guide')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Under 30 min' }))
    expect(titles()).toEqual(['Quick drum'])
  })

  it('WG05 Clear filters in the empty state restores the whole list', () => {
    mount({ initialSearch: 'zzz-no-such-guide' })
    expect(screen.getByText('Nothing matches all of those yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(titles()).toHaveLength(2)
  })

  it('WG06 renders 24 guides at first and Show more reveals the rest', () => {
    const many = Array.from({ length: 30 }, (_, i) => guide(`g${i}`, `Guide ${i}`))
    mount({ tutorials: many, stats: null })
    expect(screen.getAllByTestId('tutorial-card')).toHaveLength(24)
    expect(screen.getByText('Showing 24 of 30')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show more guides' }))
    expect(screen.getAllByTestId('tutorial-card')).toHaveLength(30)
    expect(screen.queryByRole('button', { name: 'Show more guides' })).toBeNull()
  })

  it('WG07 a card links to its guide', () => {
    mount()
    const card = screen.getAllByTestId('tutorial-card').find((c) => c.textContent?.includes('Quick drum'))!
    expect(card).toHaveAttribute('href', '/tutorials/q')
  })

  it('WG08 a signed-in Save posts the guide, and a second tap deletes the save', async () => {
    mount({ signedIn: true })
    const card = screen.getAllByTestId('tutorial-card').find((c) => c.textContent?.includes('Quick drum'))!.closest('.save-host') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(browserApiClient.post).toHaveBeenCalledWith('/api/saves', { entity_type: 'tutorial', entity_id: 'q' }))
    fireEvent.click(within(card).getByRole('button', { name: 'Saved' }))
    await vi.waitFor(() => expect(browserApiClient.delete).toHaveBeenCalledWith('/api/saves/tutorials/q'))
  })

  it('WG09 a signed-out Save goes to sign up, carrying /library and the reason, and saves nothing', () => {
    mount()
    const card = screen.getAllByTestId('tutorial-card')[0].closest('.save-host') as HTMLElement
    fireEvent.click(within(card).getAllByRole('button', { name: 'Save' })[0])
    expect(push).toHaveBeenCalledWith('/signup?next=%2Flibrary&reason=save')
    expect(browserApiClient.post).not.toHaveBeenCalled()
  })

  it('WG10 Pick for my child goes to the wizard when signed in, and through sign up with the reason when not', () => {
    const { unmount } = mount({ signedIn: true })
    expect(screen.getAllByRole('link', { name: /Pick for my child/ }).map((a) => a.getAttribute('href'))).toEqual(['/onboarding/child', '/onboarding/child'])
    unmount()
    mount()
    expect(screen.getAllByRole('link', { name: /Pick for my child/ }).map((a) => a.getAttribute('href'))).toEqual([
      '/signup?next=%2Fonboarding%2Fchild&reason=child',
      '/signup?next=%2Fonboarding%2Fchild&reason=child',
    ])
  })

  it('WG11 the hero, the filter note and the empty state link to the guide and idea forms and the toy library', () => {
    mount({ initialSearch: 'zzz-no-such-guide' })
    expect(screen.getByRole('link', { name: 'Submit a guide' })).toHaveAttribute('href', '/get-involved/submit-a-tutorial')
    expect(screen.getAllByRole('link', { name: /Submit an idea/ }).map((a) => a.getAttribute('href'))).toEqual([
      '/get-involved/submit-an-idea',
      '/get-involved/submit-an-idea',
    ])
    expect(screen.getByRole('link', { name: /Browse toys instead/ })).toHaveAttribute('href', '/toy-library')
  })
})
