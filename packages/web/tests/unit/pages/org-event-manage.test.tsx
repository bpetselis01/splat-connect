import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const regs = vi.hoisted(() => ({ current: [] as unknown[] }))

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({ profile: { id: 'u1' }, isAdmin: false, ledOrgs: [{ id: 'o1', name: 'Splat North', status: 'active' }] }),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: async (path: string) => {
      if (path === '/api/organizations/o1/events')
        return [{ id: 'e1', kind: 'build_day', title: 'Build day', starts_at: '2026-11-14T00:00:00Z', status: 'published', capacity: 12, prints_parts: false, cost_cents: null, cost_note: null }]
      if (path === '/api/organizations/o1/events/e1/questions')
        return [{ id: 'q1', prompt: 'Any allergies?' }, { id: 'q2', prompt: 'Bringing a toy?' }]
      if (path === '/api/organizations/o1/events/e1/registrations') return regs.current
      if (path === '/api/toy-transactions?role=owner') return [{ id: 'p1', event_id: 'e1', status: 'requested', part_sets: 1 }]
      throw new Error(`unexpected ${path}`)
    },
  },
}))

const Page = (await import('@/app/dashboard/org/events/[id]/page')).default
const open = (id = 'e1') => Page({ params: Promise.resolve({ id }) })

const REGS = [
  { id: 'r1', name: 'Ada Lovelace', email: 'ada@example.com', created_at: '2026-10-01T00:00:00Z', answers: { q1: 'Nuts, "peanut"', q2: true } },
  { id: 'r2', name: 'Ben', email: 'ben@example.com', created_at: '2026-10-02T00:00:00Z', answers: {} },
]

describe('Manage event page', () => {
  it('WB24 shows each registrant with their answers, a dash for a blank one, and the four stat tiles', async () => {
    regs.current = REGS
    render(await open())
    const ada = screen.getByText('Ada Lovelace').closest('article')!
    expect(within(ada).getByText('Nuts, "peanut"')).toBeInTheDocument()
    expect(within(ada).getByText('Yes')).toBeInTheDocument()
    const ben = screen.getByText('Ben').closest('article')!
    expect(within(ben).getAllByText('—')).toHaveLength(2)
    const tiles = Array.from(document.querySelectorAll('dl.my-6 > div')).map((d) => d.textContent)
    expect(tiles).toEqual(['Going2', 'Part requests1', 'To answer1', 'Seats12'])
    expect(screen.getByText('2 registered · 2 questions on your form. Answers are shown to leaders only.')).toBeInTheDocument()
  })

  it('WB24 Export CSV is a data: link carrying every registrant and answer, with quotes doubled', async () => {
    regs.current = REGS
    render(await open())
    const link = screen.getByRole('link', { name: /Export CSV/ })
    expect(link).toHaveAttribute('download', 'Build day registrations.csv')
    const csv = decodeURIComponent(link.getAttribute('href')!.replace('data:text/csv;charset=utf-8,', ''))
    expect(csv).toBe(
      [
        '"Name","Email","Registered","Any allergies?","Bringing a toy?"',
        '"Ada Lovelace","ada@example.com","2026-10-01T00:00:00Z","Nuts, ""peanut""","Yes"',
        '"Ben","ben@example.com","2026-10-02T00:00:00Z","",""',
      ].join('\n'),
    )
  })

  it('WB24 with nobody registered says so and offers no export', async () => {
    regs.current = []
    render(await open())
    expect(screen.getByText('Nobody has registered yet.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Export CSV/ })).toBeNull()
  })

  it('WB24 404s for an event that is not this organisation’s', async () => {
    regs.current = []
    await expect(open('other')).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
