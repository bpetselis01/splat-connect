import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChallengeDetailPage from '@/app/get-involved/design-challenges/[id]/page'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'

vi.mock('@/lib/capabilities', () => ({ getCapabilities: vi.fn(async () => null) }))
vi.mock('@/lib/saves', () => ({ getSavedIds: async () => null }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))
vi.mock('@/components/challenge-thread', () => ({ ChallengeThread: () => null }))
vi.mock('@/components/save-button', () => ({ SaveButton: () => null }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))

export const brief = (over: object = {}) => ({
  id: 'c1', author_id: 'a1', author_name: 'Priya', title: 'Bubbles', summary: 'One switch.',
  description: 'Three to five seconds.', intended_use: null, primary_user: null, contact_prefs: [],
  status: 'challenge', tutorial_id: null, kind: 'challenge', answer_message_id: null, answered_at: null,
  created_at: '2026-08-02T03:00:00Z', updated_at: '2026-08-02T03:00:00Z', participants: [],
  maker_count: 0, answer_count: 0, save_count: 0, writing_up: null,
  ...over,
})

function serve(body: object) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
}

async function renderPage(tab?: string) {
  render(await ChallengeDetailPage({ params: Promise.resolve({ id: 'c1' }), searchParams: Promise.resolve({ tab }) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCapabilities).mockResolvedValue(null)
})

describe('ChallengeDetailPage', () => {
  it('shows makers, posts, saves and days open', async () => {
    serve(brief({ answer_count: 4, save_count: 11 }))
    await renderPage()
    expect(screen.getByText('posts')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('saves')).toBeInTheDocument()
  })

  it('leads the brief with the photo and says what a solution has to do', async () => {
    serve(brief({ photo_url: 'http://localhost:54321/storage/v1/object/public/toy-photos/ideas/a1/p.png' }))
    await renderPage('brief')
    expect(document.querySelector('img')?.getAttribute('src')).toContain('/toy-photos/ideas/a1/p.png')
    expect(screen.getByText('Three to five seconds.')).toBeInTheDocument()
    const box = screen.getByRole('heading', { name: 'What a solution has to do' })
    expect(box.nextElementSibling?.textContent).toBe('One switch.')
  })

  it('drops a photo next/image could not render', async () => {
    serve(brief({ photo_url: 'https://evil.example/p.png' }))
    await renderPage('brief')
    expect(document.querySelector('img')).toBeNull()
  })

  it('shows an anonymous challenge as anonymous, and lets its author see it is theirs', async () => {
    vi.mocked(getCapabilities).mockResolvedValue({ profile: { id: 'a1', name: 'Priya' } } as never)
    vi.mocked(apiClient.get).mockResolvedValue({ id: 'c1' })
    serve(brief({ author_id: null, author_name: null, anonymous: true }))
    await renderPage()
    expect(screen.getByText(/submitted anonymously/)).toBeInTheDocument()
    expect(screen.getByText('You have joined')).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/ideas/mine/c1')
  })

  it('WI22 sends a signed-out reader who presses Join to sign in, returning to the thread tab', async () => {
    serve(brief())
    await renderPage()
    expect(screen.getByRole('link', { name: 'Join this challenge' })).toHaveAttribute(
      'href',
      '/login?next=%2Fget-involved%2Fdesign-challenges%2Fc1%3Ftab%3Dthread'
    )
  })

  it('names who is writing a graduated challenge up', async () => {
    serve(brief({ status: 'graduated', writing_up: { profile_id: 'p1', name: 'Tom Beattie', started_at: '2026-09-02T03:00:00Z' } }))
    await renderPage()
    expect(screen.getByText('Tom Beattie is writing this up')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Follow the write-up' })).toBeInTheDocument()
  })
})
