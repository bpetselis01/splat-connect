import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let user: TestUser

const patch = (body: unknown) =>
  app.request('/api/contributors/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const stored = async () => (await adminClient().from('profiles').select('occupation').eq('id', user.id).single()).data!.occupation

beforeAll(async () => {
  user = await createTestUser()
})
afterAll(async () => {
  await deleteTestUser(user.id)
})

describe('PATCH /api/contributors/me "What you do"', () => {
  it('Z02 saves the occupation trimmed, clears it when emptied, and refuses 61 characters', async () => {
    expect((await patch({ occupation: '  Occupational therapist ' })).status).toBe(200)
    expect(await stored()).toBe('Occupational therapist')

    const tooLong = await patch({ occupation: 'x'.repeat(61) })
    expect(tooLong.status).toBe(400)
    expect(await stored()).toBe('Occupational therapist')

    expect((await patch({ occupation: '   ' })).status).toBe(200)
    expect(await stored()).toBeNull()
  })
})
