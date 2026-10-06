/**
 * Auth reads every user row when it lists users, and one row it cannot scan
 * fails the whole list. 083 inserted the Deleted member placeholder by hand
 * with banned_until 'infinity' and NULL tokens, which broke the dashboard's
 * Users page and the test cleanup script until 131.
 */
import { describe, it, expect } from 'vitest'
import { adminClient } from '../../helpers/auth.js'

const GHOST = '00000000-0000-4000-8000-00000000dead'

describe('the Deleted member placeholder', () => {
  it('leaves Auth able to list users', async () => {
    const { data, error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 })
    expect(error).toBeNull()
    expect(data.users.length).toBeGreaterThan(0)
  })

  it('stays banned', async () => {
    const { data, error } = await adminClient().auth.admin.getUserById(GHOST)
    expect(error).toBeNull()
    expect(new Date(data.user!.banned_until!).getFullYear()).toBeGreaterThan(9000)
  })
})
