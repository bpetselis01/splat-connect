import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { MemberReport } from '@/components/admin-reports'
import type { ContactMessage } from '@/components/admin-inbox'
import type { QueuedRequest } from '@/components/org-request-queue'

vi.setConfig({ testTimeout: 30_000 })

const get = vi.fn()
const del = vi.fn()
const bGet = vi.fn()
const bPost = vi.fn()
const bPatch = vi.fn()
const bPut = vi.fn()
const bDel = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), delete: (...a: unknown[]) => del(...a) },
}))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: {
    get: (...a: unknown[]) => bGet(...a),
    post: (...a: unknown[]) => bPost(...a),
    patch: (...a: unknown[]) => bPatch(...a),
    put: (...a: unknown[]) => bPut(...a),
    delete: (...a: unknown[]) => bDel(...a),
  },
}))
const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }), notFound: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

beforeEach(() => vi.clearAllMocks())

describe('admin review tabs', () => {
  it('WM03 the review queue shows the guide count and the pending idea count, and the tabs link to their queues', async () => {
    get.mockImplementation(async (path: string) =>
      path.startsWith('/api/admin/tutorials')
        ? [{ id: 't1', title: 'Spoon holder', status: 'pending', created_at: '2026-10-01T00:00:00Z', tutorial_orgs: [] }]
        : path === '/api/admin/ideas'
          ? [{ id: 'i1', status: 'pending' }, { id: 'i2', status: 'pending' }, { id: 'i3', status: 'challenge' }]
          : []
    )
    const { default: Page } = await import('@/app/admin/review/page')
    render(await Page({ searchParams: Promise.resolve({}) }))

    const tabs = screen.getByRole('navigation', { name: 'Review queues' })
    expect(within(tabs).getByRole('link', { name: 'Guides 1' })).toHaveAttribute('href', '/admin/review')
    expect(within(tabs).getByRole('link', { name: 'Guides 1' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabs).getByRole('link', { name: 'Ideas 2' })).toHaveAttribute('href', '/admin/ideas')
    expect(within(tabs).getByRole('link', { name: 'Organisations' })).toHaveAttribute('href', '/admin/organization-requests')
    expect(within(tabs).getByRole('link', { name: 'Spot check' })).toHaveAttribute('href', '/admin/spot-check')
  })
})

describe('admin accounts', () => {
  const account = (id: string, name: string, email: string) => ({ id, name, email, role: 'contributor', created_at: '2026-03-01T00:00:00Z' })
  const open = async (searchParams: Record<string, string> = {}) => {
    get.mockImplementation(async (path: string) =>
      path === '/api/admin/contributors'
        ? { accounts: [account('u1', 'Sam Leader', 'sam@example.com'), account('u2', 'Priya Maker', 'priya@example.com')], total: 2 }
        : [{ id: 'o1', name: 'Org', org_leaders: [{ user_id: 'u1' }] }]
    )
    const { default: Page } = await import('@/app/admin/contributors/page')
    render(await Page({ searchParams: Promise.resolve(searchParams) }))
  }

  it('WM16 the Leaders chip keeps only accounts that lead an organisation, and the chips count each group', async () => {
    await open({ cap: 'leaders' })
    expect(screen.getByText('sam@example.com')).toBeInTheDocument()
    expect(screen.queryByText('priya@example.com')).toBeNull()
    const chips = screen.getByRole('navigation', { name: 'Filter accounts' })
    expect(within(chips).getByRole('link', { name: 'All 2' })).toHaveAttribute('href', '/admin/contributors')
    expect(within(chips).getByRole('link', { name: 'Contributors 1' })).toHaveAttribute('href', '/admin/contributors?cap=contributors')
    expect(within(chips).getByRole('link', { name: 'Leaders 1' })).toHaveAttribute('aria-current', 'page')
  })

  it('WM16 the search keeps accounts whose name or email contains the text, ignoring case', async () => {
    await open({ q: 'PRIYA' })
    expect(screen.getByText('priya@example.com')).toBeInTheDocument()
    expect(screen.queryByText('sam@example.com')).toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Search accounts' })).toHaveValue('PRIYA')
  })

  it('WM17 Delete account asks for the typed phrase, then deletes that account and refreshes', async () => {
    bDel.mockResolvedValue(null)
    await open()
    const row = screen.getAllByTestId('contributor-row').find((r) => r.textContent?.includes('priya@example.com'))!
    fireEvent.click(within(row).getByRole('button', { name: 'Delete account' }))
    const dialog = within(row).getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()
    expect(bDel).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText(/to confirm/i), { target: { value: 'confirm_delete_account' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(bDel).toHaveBeenCalledWith('/api/admin/contributors/u2'))
    expect(bDel).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})

describe('admin organisation requests', () => {
  const request = (over: Partial<QueuedRequest> = {}): QueuedRequest => ({
    id: 'r1', requester_id: 'u1', reviewed_by: null, reviewed_at: null, updated_at: '', org_name: 'Eastside Therapy', what_they_do: 'Paediatric OT.', verification: 'Work email.', status: 'pending' as const,
    created_at: '2026-10-01T00:00:00Z', organization_id: null, review_note: null,
    requester: { name: 'Sam', email: 'sam@example.com' }, ...over,
  })

  it('WM23 Approve and create it posts the approval for that request and refreshes', async () => {
    const { OrgRequestQueue } = await import('@/components/org-request-queue')
    bPost.mockResolvedValue({})
    render(<OrgRequestQueue requests={[request(), request({ id: 'r2', org_name: 'Other' })]} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve and create it' })[0])
    await waitFor(() => expect(bPost).toHaveBeenCalledWith('/api/admin/organization-requests/r1/approve', {}))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WM24 Decline sends the trimmed note, and Send the decline stays disabled until there is one', async () => {
    const { OrgRequestQueue } = await import('@/components/org-request-queue')
    bPost.mockResolvedValue({})
    render(<OrgRequestQueue requests={[request()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(screen.getByRole('button', { name: 'Send the decline' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Why, in a way they can act on/), { target: { value: ' Apply from your work address. ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the decline' }))
    await waitFor(() =>
      expect(bPost).toHaveBeenCalledWith('/api/admin/organization-requests/r1/decline', { note: 'Apply from your work address.' })
    )
  })

  it('WM23 a refused approval shows the API sentence and does not refresh', async () => {
    const { OrgRequestQueue } = await import('@/components/org-request-queue')
    bPost.mockRejectedValue(new Error('POST failed {"error":"That request is not open."}'))
    render(<OrgRequestQueue requests={[request()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve and create it' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That request is not open.')
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('admin inbox', () => {
  const message = (over: Partial<ContactMessage> = {}): ContactMessage => ({
    id: 'm1', topic: 'safety' as const, name: 'Jen', email: 'jen@example.com', body: 'A screw came loose.', status: 'open' as const,
    created_at: '2026-10-01T00:00:00Z', ...over,
  })

  it('WM25 Replied and Close each patch the message status, and Reopen sends open', async () => {
    const { AdminInbox } = await import('@/components/admin-inbox')
    bPatch.mockResolvedValue({})
    const first = render(<AdminInbox messages={[message()]} />)
    fireEvent.click(screen.getByRole('button', { name: /Replied/ }))
    await waitFor(() => expect(bPatch).toHaveBeenLastCalledWith('/api/admin/inbox/m1', { status: 'replied' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(bPatch).toHaveBeenLastCalledWith('/api/admin/inbox/m1', { status: 'closed' }))
    first.unmount()

    render(<AdminInbox messages={[message({ status: 'closed' })]} />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Closed/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    await waitFor(() => expect(bPatch).toHaveBeenLastCalledWith('/api/admin/inbox/m1', { status: 'open' }))
  })

  it('WM25 each status tab counts its messages and the reply link is a mailto to the sender', async () => {
    const { AdminInbox } = await import('@/components/admin-inbox')
    render(<AdminInbox messages={[message(), message({ id: 'm2', status: 'replied' }), message({ id: 'm3', status: 'closed' })]} />)
    expect(screen.getByRole('tab', { name: 'Open 1' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Replied 1' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Closed 1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'jen@example.com' }).getAttribute('href')).toMatch(/^mailto:jen@example\.com\?subject=/)
  })

  it('WM25 shows the API sentence when the status does not save', async () => {
    const { AdminInbox } = await import('@/components/admin-inbox')
    bPatch.mockRejectedValue(new Error('That did not save.'))
    render(<AdminInbox messages={[message()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That did not save.')
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('admin reports', () => {
  const report = (over: Partial<MemberReport> = {}): MemberReport => ({
    id: 'r1', subject_kind: 'guide', subject_label: 'Spoon holder', category: 'safety' as const, body: 'The clip snapped.',
    ok_to_contact: true, status: 'new' as const, note_to_reporter: null, reporter_name: 'Priya', created_at: '2026-10-01T00:00:00Z', ...over,
  })

  it('WM26 the page lists member reports by default and the Idea reports tab loads the idea reports', async () => {
    get.mockImplementation(async (path: string) => (path === '/api/admin/member-reports' ? [report()] : []))
    const { default: Page } = await import('@/app/admin/reports/page')
    const first = render(await Page({ searchParams: Promise.resolve({}) }))
    const nav = screen.getByRole('navigation', { name: 'Kind of report' })
    expect(within(nav).getByRole('link', { name: 'Member reports' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Idea reports' })).toHaveAttribute('href', '/admin/reports?tab=ideas')
    expect(screen.getByText(/Spoon holder/)).toBeInTheDocument()
    first.unmount()

    render(await Page({ searchParams: Promise.resolve({ tab: 'ideas' }) }))
    expect(get).toHaveBeenLastCalledWith('/api/admin/reports')
    expect(screen.getByRole('link', { name: 'Idea reports' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(/No idea reports/)).toBeInTheDocument()
  })

  it('WM27 Start looking patches the report to looking', async () => {
    const { AdminReports } = await import('@/components/admin-reports')
    bPatch.mockResolvedValue({})
    render(<AdminReports reports={[report()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start looking' }))
    await waitFor(() => expect(bPatch).toHaveBeenCalledWith('/api/admin/member-reports/r1', { status: 'looking' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('WM28 Resolve patches a report that is being looked at to resolved, and a resolved one offers neither', async () => {
    const { AdminReports } = await import('@/components/admin-reports')
    bPatch.mockResolvedValue({})
    const first = render(<AdminReports reports={[report({ status: 'looking' })]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    await waitFor(() => expect(bPatch).toHaveBeenCalledWith('/api/admin/member-reports/r1', { status: 'resolved' }))
    first.unmount()

    render(<AdminReports reports={[report({ status: 'resolved' })]} />)
    expect(screen.queryByRole('button', { name: /Start looking|Resolve/ })).toBeNull()
  })

  it('WM29 Note to reporter sends the trimmed note and Send it is disabled while the note is blank', async () => {
    const { AdminReports } = await import('@/components/admin-reports')
    bPatch.mockResolvedValue({})
    render(<AdminReports reports={[report()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Note to reporter' }))
    expect(screen.getByRole('button', { name: 'Send it' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Note to the reporter'), { target: { value: ' We have pulled the guide. ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send it' }))
    await waitFor(() =>
      expect(bPatch).toHaveBeenCalledWith('/api/admin/member-reports/r1', { note_to_reporter: 'We have pulled the guide.' })
    )
  })

  it('WM27 a refused change shows the error and does not refresh', async () => {
    const { AdminReports } = await import('@/components/admin-reports')
    bPatch.mockRejectedValue(new Error('Not allowed.'))
    render(<AdminReports reports={[report()]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start looking' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed.')
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('admin test prints', () => {
  it('WM34 Fail sends the verdict fail with the note, and an empty list says so', async () => {
    const { AdminTestPrints } = await import('@/components/admin-test-prints')
    bPatch.mockResolvedValue({})
    const first = render(
      <AdminTestPrints prints={[{ id: 't1', printer_name: 'Bambu P1S', owner_name: 'Tom B.', photo: null, submitted_at: '2026-10-01T00:00:00Z', verdict: null, note: null }]} />
    )
    fireEvent.change(screen.getByLabelText('Note for Bambu P1S'), { target: { value: 'Stringing.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fail' }))
    await waitFor(() => expect(bPatch).toHaveBeenCalledWith('/api/admin/test-prints/t1', { verdict: 'fail', note: 'Stringing.' }))
    first.unmount()

    render(<AdminTestPrints prints={[]} />)
    expect(screen.getByText('No test prints yet.')).toBeInTheDocument()
  })
})

describe('admin build requests and print jobs', () => {
  it('WM32 flagged build requests come first with their words, and each row opens its thread', async () => {
    get.mockResolvedValue([
      { id: 'b1', status: 'requested', tutorial_title: 'Healthy one', requester_suburb: 'Newtown', build_brief: null, age_days: 3, idle_days: 3, unclaimed_too_long: false, claimed_and_silent: false },
      { id: 'b2', status: 'accepted', tutorial_title: 'Silent one', requester_suburb: 'Glebe', build_brief: 'Needs a larger grip', age_days: 20, idle_days: 11, unclaimed_too_long: false, claimed_and_silent: true },
      { id: 'b3', status: 'requested', tutorial_title: 'Waiting one', requester_suburb: null, build_brief: null, age_days: 16, idle_days: 16, unclaimed_too_long: true, claimed_and_silent: false },
    ])
    const { default: Page } = await import('@/app/admin/build-requests/page')
    render(await Page())
    const rows = screen.getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual([
      'Silent one · Family in GlebeClaimed, no movement in 11 days · “Needs a larger grip”StalledOpen the thread',
      'Waiting one · Family in an unknown suburb16 days unclaimedNeeds attentionOpen the thread',
      'Healthy one · Family in Newtown3 days openHealthyOpen the thread',
    ])
    expect(within(rows[0]).getByRole('link', { name: 'Open the thread' })).toHaveAttribute('href', '/dashboard/exchanges/build/b2')
  })

  it('WM32 says so when there are no open build requests', async () => {
    get.mockResolvedValue([])
    const { default: Page } = await import('@/app/admin/build-requests/page')
    render(await Page())
    expect(screen.getByText('No open build requests.')).toBeInTheDocument()
  })

  const job = (id: string, over: Record<string, unknown> = {}) => ({
    id, status: 'accepted', tutorial_title: `Guide ${id}`, printer_name: 'Bambu', requester_id: 'u1', event_id: null,
    printing_started_at: null, ready_at: null, idle_days: 2, stalled: false, decline_reason: null, ...over,
  })
  const openJobs = async (show?: string) => {
    get.mockImplementation(async (path: string) =>
      path === '/api/admin/print-jobs'
        ? [job('j1', { stalled: true, idle_days: 12 }), job('j2', { status: 'completed' }), job('j3', { status: 'rejected', decline_reason: 'Out of filament' }), job('j4', { status: 'requested' })]
        : { accounts: [{ id: 'u1', name: 'Priya', email: 'p@x' }], total: 1 }
    )
    const { default: Page } = await import('@/app/admin/print-jobs/page')
    render(await Page({ searchParams: Promise.resolve(show ? { show } : {}) }))
  }

  it('WM33 the filter links count each bucket and Stalled keeps only the stalled job, which opens its request', async () => {
    await openJobs('stalled')
    const nav = screen.getByRole('navigation', { name: 'Filter print jobs' })
    expect(within(nav).getByRole('link', { name: 'All · 4' })).toHaveAttribute('href', '/admin/print-jobs')
    expect(within(nav).getByRole('link', { name: 'Stalled · 1' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Collected · 1' })).toHaveAttribute('href', '/admin/print-jobs?show=done')
    expect(within(nav).getByRole('link', { name: 'Expired / declined · 1' })).toHaveAttribute('href', '/admin/print-jobs?show=closed')
    expect(screen.getByText('Guide j1')).toBeInTheDocument()
    expect(screen.queryByText('Guide j2')).toBeNull()
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/dashboard/print-requests/j1')
    expect(screen.getByText('1 jobs shown')).toBeInTheDocument()
  })

  it('WM33 the closed filter shows the declined job with its reason', async () => {
    await openJobs('closed')
    expect(screen.getByText('Guide j3')).toBeInTheDocument()
    expect(screen.getByText('Declined — Out of filament')).toBeInTheDocument()
    expect(screen.queryByText('Guide j1')).toBeNull()
  })
})

describe('admin site content', () => {
  it('WM35 Save changes puts the hero, the numbers and the scenes in that order, then refreshes', async () => {
    const { SiteContentEditor } = await import('@/components/site-content-editor')
    const { LEARN_COURSE } = await import('@splat-connect/types')
    bPut.mockResolvedValue({})
    const numbers = { guides: { label: 'Guides', live: true, pinned: null, source: 'Approved guides' }, organisations: { label: 'Organisations', live: true, pinned: null, source: 'Active orgs' }, toys: { label: 'Toys', live: true, pinned: null, source: 'Published toys' } }
    const rows = [
      { key: 'home-hero', value: { eyebrow: 'Hello', headline: 'Toys for everyone', subhead: 'Sub', primary_label: 'Start', secondary_label: 'Learn' }, updated_at: '2026-10-01T00:00:00Z' },
      { key: 'home-numbers', value: numbers, updated_at: '2026-10-01T00:00:00Z' },
      { key: 'home-scenes', value: { scenes: [{ title: 'Bench', line: 'We build.' }] }, updated_at: '2026-10-01T00:00:00Z' },
    ]
    render(<SiteContentEditor rows={rows} learnCourse={LEARN_COURSE} learnVersion={null} />)
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Toys for every child' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(bPut).toHaveBeenCalledTimes(3))
    expect(bPut.mock.calls).toEqual([
      ['/api/admin/content/home-hero', { value: { eyebrow: 'Hello', headline: 'Toys for every child', subhead: 'Sub', primary_label: 'Start', secondary_label: 'Learn' } }],
      ['/api/admin/content/home-numbers', { value: numbers }],
      ['/api/admin/content/home-scenes', { value: { scenes: [{ title: 'Bench', line: 'We build.' }] } }],
    ])
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('WM35 a failed save shows the error and stops before the later sections', async () => {
    const { SiteContentEditor } = await import('@/components/site-content-editor')
    const { LEARN_COURSE } = await import('@splat-connect/types')
    bPut.mockRejectedValueOnce(new Error('Hero did not save.'))
    render(<SiteContentEditor rows={[]} learnCourse={LEARN_COURSE} learnVersion={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Hero did not save.')
    expect(bPut).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })
})
