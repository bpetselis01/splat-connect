import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import NotificationsPage from '@/app/notifications/page'
import { MarkAllReadButton } from '@/components/mark-all-read-button'
import { NotificationsList } from '@/components/notifications-list'

vi.mock('@/lib/capabilities', () => ({ getCapabilities: async () => ({ isAdmin: true }) }))
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ apiClient: api }))
const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/components/notifications-list', () => ({ NotificationsList: () => null }))

type Props = Record<string, unknown> & { children?: ReactNode }

// The page's server actions are closures inside the component, so the only way
// to call them as the browser does is to take them off the elements they are
// handed to.
function find(node: ReactNode, match: (type: unknown, props: Props) => boolean): ReactElement<Props> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, match)
      if (hit) return hit
    }
    return null
  }
  const el = node as ReactElement<Props>
  if (match(el.type, el.props)) return el
  return find(el.props?.children, match)
}

const note = (id: string, read_at: string | null = null) => ({ id, type: 'tutorial_approved', read_at, created_at: '2026-10-01T00:00:00Z' })

async function render(rows: unknown[], invites: unknown[] = []) {
  api.get.mockImplementation(async (path: string) => (path === '/api/collaborators/me/invites' ? invites : rows))
  const ui = await NotificationsPage()
  const list = find(ui, (type) => type === NotificationsList)!.props as {
    pendingInvitesByTutorial: Record<string, string>
    isAdmin: boolean
    onMarkRead: (id: string) => Promise<void>
    onAcceptInvite: (id: string) => Promise<void>
    onDeclineInvite: (id: string) => Promise<void>
  }
  const button = find(ui, (type) => type === MarkAllReadButton)
  return { ui, list, markAll: button ? (button.props.action as () => Promise<number>) : null }
}

beforeEach(() => vi.clearAllMocks())

describe('NotificationsPage', () => {
  it('WD37 reads GET /api/notifications/me and the pending invites, and hands the list the invite ids by guide', async () => {
    const { list } = await render([note('n1')], [{ id: 'inv1', tutorial_id: 't1' }])
    expect(api.get).toHaveBeenCalledWith('/api/notifications/me')
    expect(api.get).toHaveBeenCalledWith('/api/collaborators/me/invites')
    expect(list.pendingInvitesByTutorial).toEqual({ t1: 'inv1' })
    expect(list.isAdmin).toBe(true)
  })

  it('WD37 still renders when either read fails', async () => {
    api.get.mockRejectedValue(new Error('down'))
    const ui = await NotificationsPage()
    expect(find(ui, (type) => type === NotificationsList)!.props.notifications).toEqual([])
  })

  it('WD38 marks one notification read with PATCH {read:true}, then revalidates the page', async () => {
    api.patch.mockResolvedValue(undefined)
    const { list } = await render([note('n1')])
    await list.onMarkRead('n1')
    expect(api.patch).toHaveBeenCalledWith('/api/notifications/n1', { read: true })
    expect(revalidatePath).toHaveBeenCalledWith('/notifications')
  })

  it('WD39 offers Mark all read only while something is unread', async () => {
    expect((await render([note('n1', '2026-10-02T00:00:00Z')])).markAll).toBeNull()
    expect((await render([note('n1')])).markAll).toBeTypeOf('function')
  })

  it('WD39 sends one PATCH per unread row and none for the read ones, then revalidates', async () => {
    api.patch.mockResolvedValue(undefined)
    const rows = [note('n1'), note('n2', '2026-10-02T00:00:00Z'), note('n3')]
    const { markAll } = await render(rows)
    expect(await markAll!()).toBe(0)
    expect(api.patch.mock.calls).toEqual([
      ['/api/notifications/n1', { read: true }],
      ['/api/notifications/n3', { read: true }],
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/notifications')
  })

  it('WD39 with one failing PATCH the action reports 1 failure, the other rows were still sent, and the page is revalidated', async () => {
    api.patch.mockImplementation(async (path: string) => {
      if (path === '/api/notifications/n2') throw new Error('PATCH failed')
    })
    const { markAll } = await render([note('n1'), note('n2'), note('n3')])
    expect(await markAll!()).toBe(1)
    expect(api.patch).toHaveBeenCalledTimes(3)
    expect(revalidatePath).toHaveBeenCalledWith('/notifications')
  })

  it('WD40 accepts and declines a collaborator invitation by its id, then revalidates', async () => {
    api.post.mockResolvedValue(undefined)
    const { list } = await render([note('n1')])
    await list.onAcceptInvite('inv1')
    await list.onDeclineInvite('inv2')
    expect(api.post.mock.calls).toEqual([
      ['/api/collaborators/invites/inv1/accept', {}],
      ['/api/collaborators/invites/inv2/decline', {}],
    ])
    expect(revalidatePath).toHaveBeenCalledTimes(2)
  })
})
