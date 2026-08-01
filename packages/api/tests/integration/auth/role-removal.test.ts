import { describe, it, expect } from 'vitest'
import { adminClient } from '../../helpers/auth.js'

describe('the parent role has been removed', () => {
  it('rejects an insert with role=parent', async () => {
    const admin = adminClient()
    const email = `test-${crypto.randomUUID()}@splat-test.local`
    const { data, error: createError } = await admin.auth.admin.createUser({
      email,
      password: 'Test1234!',
      email_confirm: true,
    })
    expect(createError).toBeNull()
    const userId = data.user!.id

    const { error } = await admin.from('profiles').update({ role: 'parent' }).eq('id', userId)
    expect(error).not.toBeNull()
    expect(error?.message).toContain('profiles_role_check')

    await admin.auth.admin.deleteUser(userId)
  })

  it('has no remaining role=parent rows after the backfill', async () => {
    const admin = adminClient()
    const { data, error } = await admin.from('profiles').select('id').eq('role', 'parent')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
