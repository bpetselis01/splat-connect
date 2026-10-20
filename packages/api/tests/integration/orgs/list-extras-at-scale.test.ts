// journeys: (none — route coverage; scale case, no journey row)
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const COUNT = 220
const prefix = `Scale Org ${crypto.randomUUID().slice(0, 8)} `
let admin: TestUser

beforeAll(async () => {
  admin = await createTestUser('admin')
  const rows = Array.from({ length: COUNT }, (_, i) => ({
    name: `${prefix}${i}`,
    created_by: admin.id,
    status: 'active',
  }))
  const { error } = await adminClient().from('organizations').insert(rows)
  if (error) throw new Error(`seed failed: ${error.message}`)
})

afterAll(async () => {
  await adminClient().from('organizations').delete().like('name', `${prefix}%`)
  await deleteTestUser(admin.id)
})

describe('GET /api/organizations at scale', () => {
  it('keeps the extra columns on every row past the URL-length limit', async () => {
    const res = await app.request('/api/organizations', {
      headers: { Authorization: `Bearer ${admin.token}` },
    })
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ name: string; verified_at?: string | null }>
    const mine = list.filter((o) => o.name.startsWith(prefix))
    expect(mine).toHaveLength(COUNT)
    expect(mine.filter((o) => 'verified_at' in o)).toHaveLength(COUNT)
  })
})
