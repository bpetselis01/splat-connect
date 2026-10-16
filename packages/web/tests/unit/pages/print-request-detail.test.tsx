import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PrintJobPage from '@/app/dashboard/print-requests/[id]/page'

vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({
    profile: { id: 'printer-1', name: 'Sam', email: 'sam@example.com', role: 'contributor' },
    isAdmin: false,
    ledOrgs: [],
    exchangeActions: 0,
  }),
}))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  usePathname: () => null,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('@/components/live-transaction', () => ({ LiveTransaction: () => null }))
// The thread is a client component with its own fetching; only the aside it
// is handed (where the job details live) matters here.
vi.mock('@/components/toy-transaction-thread', () => ({
  ToyTransactionThread: ({ asideTop }: { asideTop: React.ReactNode }) => <>{asideTop}</>,
}))

import { apiClient } from '@/lib/api-client'

const job = (over: object) => ({
  id: 'tx-1',
  type: 'print',
  status: 'requested',
  toy_id: null,
  offered_toy_id: null,
  requester_id: 'family-1',
  owner_id: 'printer-1',
  owner_org_id: null,
  tutorial_id: 'tut-1',
  tutorial_title: 'Switch mount',
  printer_id: 'p1',
  printer: { id: 'p1', name: 'Bench', suburb: 'Newtown', state: 'NSW', materials: ['PLA'] },
  print_files: [{ id: 'f1', filename: 'body.stl', quantity: 1, print_minutes: 60, filament_grams: 10, material: 'PLA' }],
  print_note: 'Blue please',
  print_fit_notes: null,
  print_group_id: null,
  print_colour: null,
  print_delivery: null,
  owner_name: 'Sam',
  requester_name: 'Jamie',
  messages: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...over,
})

async function open(over: object) {
  vi.mocked(apiClient.get).mockImplementation(async (path: string) =>
    path.startsWith('/api/exchange-costs') ? { lines: [], settlement: null } : job(over)
  )
  render(await PrintJobPage({ params: Promise.resolve({ id: 'tx-1' }) }))
}

// Tests: the family's customization answers (096) are read under the note on the
//        printer's job page, and a job without them draws no empty lines.
describe('print request detail, customization answers', () => {
  it('lists the answers under the note', async () => {
    await open({ print_fit_notes: [{ label: 'Reach from seated', value: '20–40 cm' }, { label: 'Preferred switch size', value: 'Large (100 mm)' }] })
    expect(screen.getByText('Blue please')).toBeTruthy()
    expect(screen.getByText('Reach from seated: 20–40 cm')).toBeTruthy()
    expect(screen.getByText('Preferred switch size: Large (100 mm)')).toBeTruthy()
  })

  it('draws none when there are no answers', async () => {
    await open({ print_fit_notes: null })
    expect(screen.getByText('Blue please')).toBeTruthy()
    expect(screen.queryByText(/Reach from seated/)).toBeNull()
  })
})

// Tests: the family sees the credit a job spent (114) while it is live, and not
//        on a job that was declined or withdrawn, where nothing was spent.
describe('print request detail, recycling credit', () => {
  const asFamily = { requester_id: 'printer-1', owner_id: 'maker-9', print_credit_grams: 120 }

  it.each(['accepted', 'completed'])('shows the credit on a %s job', async (status) => {
    await open({ ...asFamily, status })
    expect(screen.getByText('Your recycling credit (120 g)')).toBeTruthy()
  })

  it.each(['requested', 'rejected', 'withdrawn'])('hides it on a %s job', async (status) => {
    await open({ ...asFamily, status })
    expect(screen.queryByText('Your recycling credit (120 g)')).toBeNull()
  })
})
