import { describe, it, expect, vi, beforeEach } from 'vitest'

const inserts: unknown[][] = []
let outcome: () => Promise<{ error: { code?: string; message: string } | null }>

vi.mock('../../src/supabase/client.js', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async (rows: unknown[]) => {
        inserts.push(rows)
        return outcome()
      },
    }),
  }),
}))

import { notify } from '../../src/notify.js'

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ recipient_id: `u${i}`, type: 'leader_added' }))

describe('notify', () => {
  beforeEach(() => {
    inserts.length = 0
    outcome = async () => ({ error: null })
    vi.restoreAllMocks()
  })

  it('does nothing for no rows', async () => {
    await notify([], 'leader_added')
    expect(inserts).toEqual([])
  })

  it('inserts in chunks of 500', async () => {
    await notify(rows(1001), 'leader_added')
    expect(inserts.map((part) => part.length)).toEqual([500, 500, 1])
  })

  it('logs the row count when it has to chunk, and not for a single chunk', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await notify(rows(500), 'leader_added')
    expect(log).not.toHaveBeenCalled()
    await notify(rows(1001), 'leader_added')
    expect(log).toHaveBeenCalledWith('[notify] chunked rows=1001 label=leader_added')
  })

  it('logs the CHECK refusing a type and does not throw', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    outcome = async () => ({ error: { code: '23514', message: 'violates check constraint' } })
    await expect(notify(rows(2), 'org_leader_add')).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('[notify] insert failed type=leader_added code=23514 label=org_leader_add')
  })

  it('logs a thrown insert and does not throw', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    outcome = async () => {
      throw new Error('socket hang up')
    }
    await expect(notify(rows(1), 'x')).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('[notify] insert failed type=leader_added code=thrown label=x')
  })
})
