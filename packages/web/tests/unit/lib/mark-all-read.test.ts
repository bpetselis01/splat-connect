import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.hoisted(() => vi.fn())
const patch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api-client', () => ({ apiClient: { get, patch } }))

const { markAllRead } = await import('@/lib/mark-all-read')

const row = (id: string, read_at: string | null) => ({ id, read_at })

describe('markAllRead', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset().mockResolvedValue({})
  })

  it('patches only unread rows and reports 0 failures', async () => {
    get.mockResolvedValue([row('a', null), row('b', '2026-01-01'), row('c', null)])
    expect(await markAllRead()).toBe(0)
    expect(patch.mock.calls).toEqual([
      ['/api/notifications/a', { read: true }],
      ['/api/notifications/c', { read: true }],
    ])
  })

  it('counts the PATCHes that failed instead of ignoring them', async () => {
    get.mockResolvedValue([row('a', null), row('b', null), row('c', null)])
    patch.mockImplementation(async (path: string) => {
      if (path.endsWith('/b')) throw new Error('500')
      return {}
    })
    expect(await markAllRead()).toBe(1)
  })
})
