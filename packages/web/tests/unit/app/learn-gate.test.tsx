/**
 * site-content-learn-legal-editing: "Shown as" on the course pages themselves
 * (Byron, 2026-10-02). The gate is in every page under app/learn/(course)/,
 * not in a layout — Next never re-runs a layout on in-app navigation, so a
 * layout's check could be walked around by clicking from one page to the next.
 * These render the real pages through the real gate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isValidElement, type ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { LEARN_COURSE } from '@splat-connect/types'
import { LearnGate } from '@/components/learn-gate'
import SwitchTypes from '@/app/learn/(course)/switch-types/page'
import AskAnExpert from '@/app/learn/ask-an-expert/page'

const get = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
const caps = vi.fn()
vi.mock('@/lib/capabilities', () => ({ getCapabilities: () => caps() }))
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect ${to}`)
})
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<object>()),
  redirect: (to: string) => redirect(to),
  usePathname: () => '/learn/switch-types',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const PUBLIC = '/api/public/learn-course'
const ADMIN = '/api/admin/content'
const hiddenPublic = { title: null, outcome: null, shown_as: 'hidden', units: [] }
const savedRow = {
  key: 'learn-course',
  value: {
    shown_as: 'hidden',
    units: [{ id: 'start-here', title: 'Start here', blurb: '', lessons: [{ slug: 'switch-types', title: 'Switches, renamed', minutes: 7, kind: 'read' }] }],
  },
}
const serve = (pub: unknown, rows?: unknown) =>
  get.mockImplementation(async (path: string) => {
    if (path === PUBLIC) return pub
    if (path === ADMIN && rows) return rows
    throw new Error(`unexpected ${path}`)
  })

/** What Next does on every navigation to a course page: render it, gate and all. */
async function renderPage(Page: () => ReactElement) {
  const el = Page()
  expect(el.type).toBe(LearnGate)
  render(await LearnGate(el.props as Parameters<typeof LearnGate>[0]))
}

beforeEach(() => {
  vi.clearAllMocks()
  caps.mockResolvedValue(null)
})

describe('every course page is gated', () => {
  const root = resolve(__dirname, '../../../app/learn/(course)')
  const pages = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? pages(p) : f === 'page.tsx' ? [p] : []
    })

  it('renders each of the seventeen inside LearnGate', async () => {
    const files = pages(root)
    expect(files).toHaveLength(17)
    for (const f of files) {
      const mod = (await import(f)) as { default: () => ReactElement }
      const el = mod.default()
      expect(isValidElement(el) && el.type === LearnGate, f).toBe(true)
    }
  })

  it('leaves Ask an expert, which is not part of the course, ungated', () => {
    const el = AskAnExpert() as ReactElement
    expect(el.type).not.toBe(LearnGate)
  })
})

describe('LearnGate on a course page', () => {
  it('WE01 shows the lesson when Free, and when the course cannot be read', async () => {
    serve(LEARN_COURSE)
    await renderPage(SwitchTypes)
    expect(screen.getByRole('heading', { level: 1, name: 'Switch types explained' })).toBeTruthy()
    expect(caps).not.toHaveBeenCalled()
    get.mockRejectedValue(new Error('down'))
    await renderPage(SwitchTypes)
    expect(screen.getAllByRole('heading', { level: 1, name: 'Switch types explained' })).toHaveLength(2)
  })

  it('WE01 says "Course hidden" to a member, and to a signed-out reader', async () => {
    serve(hiddenPublic)
    caps.mockResolvedValue({ isAdmin: false })
    await renderPage(SwitchTypes)
    expect(screen.getByRole('heading', { name: 'Course hidden' })).toBeTruthy()
    expect(screen.queryByText('Switch types explained')).toBeNull()
    expect(get).not.toHaveBeenCalledWith(ADMIN)
    caps.mockResolvedValue(null)
    await renderPage(SwitchTypes)
    expect(screen.getAllByRole('heading', { name: 'Course hidden' })).toHaveLength(2)
    expect(redirect).not.toHaveBeenCalled()
  })

  it("WE01 previews a hidden course for an admin from the saved row, under 'Hidden from members'", async () => {
    serve(hiddenPublic, [savedRow])
    caps.mockResolvedValue({ isAdmin: true })
    await renderPage(SwitchTypes)
    expect(screen.getByRole('status')).toHaveTextContent('Hidden from members')
    // The saved outline, not the empty public one: the renamed lesson heads the page.
    expect(screen.getByRole('heading', { level: 1, name: 'Switches, renamed' })).toBeTruthy()
  })

  it('WE02 sends a signed-out reader to sign in, then back to the lesson, when sign-in is needed, and lets a member in', async () => {
    serve({ ...LEARN_COURSE, shown_as: 'sign_in' })
    await expect(renderPage(SwitchTypes)).rejects.toThrow('redirect /login?next=%2Flearn%2Fswitch-types')
    caps.mockResolvedValue({ isAdmin: false })
    await renderPage(SwitchTypes)
    expect(screen.getByRole('heading', { level: 1, name: 'Switch types explained' })).toBeTruthy()
  })
})
