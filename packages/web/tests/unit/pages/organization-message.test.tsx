import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockGetCapabilities, mockGet, fetchMock } = vi.hoisted(() => ({
  mockGetCapabilities: vi.fn(),
  mockGet: vi.fn(),
  fetchMock: vi.fn(),
}))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: mockGet } }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('@/components/org-thread', () => ({
  OrgThreadView: (p: { side: string; sendPath: string; viewerId: string; thread: unknown }) => (
    <p>THREAD {p.side} {p.viewerId} {p.sendPath} {p.thread ? 'existing' : 'empty'}</p>
  ),
}))
vi.stubGlobal('fetch', fetchMock)

async function run() {
  const { default: Page } = await import('@/app/organizations/[id]/message/page')
  return Page({ params: Promise.resolve({ id: 'o1' }) })
}

// The first import pulls the icon set in cold, which can outlast the default 5s on a busy machine.
beforeAll(() => import('@/app/organizations/[id]/message/page'), 120_000)

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'o1', name: 'Northbank Therapy' }) })
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path.endsWith('/me') ? { leads: false } : null)
  )
})

describe('message an organisation page', () => {
  it('WN13 sends a signed-out visitor to sign in and returns to the message page', async () => {
    mockGetCapabilities.mockResolvedValue(null)
    await expect(run()).rejects.toThrow('REDIRECT:/login?next=%2Forganizations%2Fo1%2Fmessage')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('WN13 sends a leader of the organisation to its inbox instead', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'l1' } })
    mockGet.mockImplementation((path: string) => Promise.resolve(path.endsWith('/me') ? { leads: true } : null))
    await expect(run()).rejects.toThrow('REDIRECT:/dashboard/organisation/messages')
  })

  it('WN12 gives a member the composer posting to their own conversation with the organisation', async () => {
    mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
    render(await run())
    expect(screen.getByRole('heading', { level: 1, name: 'Message Northbank Therapy' })).toBeInTheDocument()
    expect(screen.getByText('THREAD family u1 /api/organizations/o1/conversations/mine/messages empty')).toBeInTheDocument()
    expect(mockGet).toHaveBeenCalledWith('/api/organizations/o1/conversations/mine')
  })
})
