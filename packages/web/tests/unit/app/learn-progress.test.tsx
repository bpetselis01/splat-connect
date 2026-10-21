import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import { LEARN_COURSE, learnLessons } from '@splat-connect/types'
import content from '@/lib/learn-content.json'
import LearnPage from '@/app/learn/(course)/page'
import AskAnExpert from '@/app/learn/ask-an-expert/page'

// Past the gate: the gate has its own tests (learn-gate.test.tsx).
vi.mock('@/components/learn-gate', () => ({ LearnGate: ({ children }: { children: React.ReactNode }) => children }))

const LESSONS = learnLessons(LEARN_COURSE)
const stored = () => JSON.parse(window.localStorage.getItem('splat_learn') ?? '{}') as {
  done?: Record<string, boolean>
  answers?: Record<string, Record<number, number>>
}

async function pageFor(slug: string): Promise<() => ReactElement> {
  const mod = (await import(`@/app/learn/(course)/${slug}/page`)) as { default: () => ReactElement }
  return mod.default
}

// Node's own experimental localStorage shadows jsdom's and has no backing file here.
const mem = new Map<string, string>()
beforeEach(() => {
  mem.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  })
})

describe('Learn progress in localStorage', () => {
  it('WE03 Continue names the next unfinished lesson and the done count, from stored progress', () => {
    window.localStorage.setItem('splat_learn', JSON.stringify({ done: { 'toy-adaptation-101': true } }))
    render(<LearnPage />)
    expect(screen.getByRole('link', { name: 'Continue: How a switch works' })).toHaveAttribute(
      'href',
      '/learn/how-a-switch-works'
    )
    expect(screen.getByText(`1 of ${LESSONS.length} lessons`)).toBeInTheDocument()
  })

  const reads = LESSONS.filter((l) => l.kind !== 'quiz')
  it.each(reads.map((l) => [l.slug, l.title] as const))(
    'WE04 WE05 WE06 WE07 WE08 WE09 WE10 WE11 WE12 WE13 WE14 WE15 %s: Done — next marks it done and links the following lesson',
    async (slug, title) => {
      const Page = await pageFor(slug)
      render(<Page />)
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
      const nextLesson = LESSONS[LESSONS.findIndex((l) => l.slug === slug) + 1]
      const link = screen.getByRole('link', { name: `Done — next: ${nextLesson.title}` })
      expect(link).toHaveAttribute('href', `/learn/${nextLesson.slug}`)
      expect(stored().done).toBeUndefined()
      link.addEventListener('click', (e) => e.preventDefault()) // jsdom cannot navigate
      fireEvent.click(link)
      expect(stored().done).toEqual({ [slug]: true })
      expect(
        within(screen.getByRole('navigation', { name: 'Course outline' })).getByLabelText('Done')
      ).toBeInTheDocument()
    }
  )

  const quizzes = LESSONS.filter((l) => l.kind === 'quiz')
  type Quiz = { q: string; opts: string[]; a: number }[]
  const answerAll = (qs: Quiz, pick: (q: Quiz[number]) => number) => {
    for (const q of qs) {
      fireEvent.click(within(screen.getByRole('group', { name: q.q })).getByRole('button', { name: q.opts[pick(q)] }))
    }
  }
  it.each(quizzes.map((l) => [l.slug] as const))(
    'WE16 WE17 WE18 WE19 %s: all answered marks it done and scores it, and Clear my answers resets',
    async (slug) => {
      const qs = (content.quizzes as unknown as Record<string, Quiz>)[slug]
      const final = slug === 'final-checkpoint'
      const Page = await pageFor(slug)
      render(<Page />)
      expect(screen.getByText('Answer every question to continue.')).toBeInTheDocument()

      // One wrong answer, the rest right.
      answerAll(qs, (q) => (q === qs[0] ? (q.a + 1) % q.opts.length : q.a))
      expect(stored().done).toEqual({ [slug]: true })
      expect(Object.keys(stored().answers?.[slug] ?? {})).toHaveLength(qs.length)
      expect(
        screen.getByRole('heading', { name: final ? 'You finished the course.' : `${qs.length - 1} of ${qs.length} right.` })
      ).toBeInTheDocument()
      expect(screen.queryByText('Answer every question to continue.')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Clear my answers and try again' }))
      expect(stored().done).toEqual({})
      expect(stored().answers).toEqual({})
      expect(screen.getByText('Answer every question to continue.')).toBeInTheDocument()
    }
  )
})

describe('Ask an expert', () => {
  it('WE20 sends each kind of question to where it is answered, and safety to Contact', () => {
    render(<AskAnExpert />)
    expect(screen.getByRole('heading', { level: 1, name: 'Have a question?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /About a step in a guide/ })).toHaveAttribute('href', '/library')
    expect(screen.getByRole('link', { name: /Which switch, which toy/ })).toHaveAttribute('href', '/learn')
    expect(screen.getByRole('link', { name: /Nobody has adapted this yet/ })).toHaveAttribute(
      'href',
      '/get-involved/submit-an-idea'
    )
    expect(screen.getByRole('link', { name: /I need a person/ })).toHaveAttribute('href', '/library')
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact')
  })
})
