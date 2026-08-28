import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TutorialCard } from '@/components/tutorial-card'
import { ToyLibraryCard } from '@/components/toy-library-card'
import { ChallengeCard } from '@/components/challenge-card'
import type { Tutorial, ToyWithOwner, ToyIdea } from '@splat-connect/types'

// Same strategy as rail.test.tsx and nav.test.tsx: next/link is mocked as a plain
// <a> and tracked, so a test can assert a link bypassed it entirely. That bypass is
// the whole behaviour under test — a crossing link must be a real <a> so the browser
// does a full load and the root layout (which decides rail vs. header) re-runs.
const pathname = vi.hoisted(() => ({ current: '/dashboard/saved/tutorials' }))
const mockLink = vi.fn(
  ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
)
vi.mock('next/link', () => ({
  default: (props: { href: string; children: React.ReactNode; [key: string]: unknown }) => mockLink(props),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

const tutorial = { id: 't1', title: 'A guide', description: null, difficulty: 'easy' } as unknown as Tutorial
const toy = { id: 'y1', name: 'A toy', cover_photo_url: null } as unknown as ToyWithOwner
const idea: Pick<ToyIdea, 'id' | 'title' | 'summary' | 'status'> = {
  id: 'i1',
  title: 'An idea',
  summary: 'A summary',
  status: 'challenge',
}

/**
 * The three cards that render on BOTH a public list and a rail-only saved list.
 *
 * From /dashboard/saved/* every one of their destinations is a public page, which
 * makes it a crossing: the root layout does not re-run on a soft transition, so a
 * next/link click left the saved list's rail on screen over /tutorials/[id]. All
 * three went unnoticed because the saved lists shipped after the cards did.
 */
describe('saved cards cross the account boundary with a full load', () => {
  beforeEach(() => {
    mockLink.mockClear()
    cleanup()
  })

  const cases = [
    ['tutorial', <TutorialCard key="t" tutorial={tutorial} />, '/tutorials/t1', '/dashboard/saved/tutorials'],
    ['toy', <ToyLibraryCard key="y" toy={toy} />, '/toy-library/y1', '/dashboard/saved/toys'],
    ['challenge', <ChallengeCard key="i" idea={idea} />, '/get-involved/design-challenges/i1', '/dashboard/saved/challenges'],
  ] as const

  for (const [name, element, href, from] of cases) {
    // Tests: from the saved list the card is a bare <a>, never next/link
    it(`renders the ${name} card as a plain anchor from its saved list`, () => {
      pathname.current = from
      render(element)
      expect(screen.getByRole('link')).toHaveAttribute('href', href)
      expect(mockLink.mock.calls.some((call) => call[0].href === href)).toBe(false)
    })

    // Tests: on the public list the same card is unchanged — no crossing, so no
    //        full page load, and every existing public page keeps its soft routing
    it(`renders the ${name} card through next/link on a public list`, () => {
      pathname.current = '/library'
      render(element)
      expect(mockLink.mock.calls.some((call) => call[0].href === href)).toBe(true)
    })
  }
})
