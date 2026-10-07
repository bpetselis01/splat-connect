/**
 * A fresh handover code: only your own, only while the handover is open, and
 * never once the other side has typed yours in. Each side recites its code for
 * the OTHER to type (confirm handler), so the counterparty's code must never
 * change here and never come back in the response.
 */
// journeys: X01 X08
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

// Runs once, between the handler's read of the handover and its UPDATE, to
// stand in for the other side confirming in that gap.
const between = vi.hoisted(() => ({ run: null as null | (() => Promise<void>) }))
vi.mock('../../../src/toy-access.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../src/toy-access.js')>()
  return {
    ...real,
    ledOrgIds: async (...a: Parameters<typeof real.ledOrgIds>) => {
      const run = between.run
      between.run = null
      if (run) await run()
      return real.ledOrgIds(...a)
    },
  }
})

let owner: TestUser
let requester: TestUser
let outsider: TestUser
let toyId: string

const newCode = (u: TestUser, id: string) =>
  app.request(`/api/toy-transactions/${id}/new-code`, { method: 'POST', headers: { Authorization: `Bearer ${u.token}` } })
const codes = async (id: string) =>
  (await adminClient().from('toy_transactions').select('owner_code, requester_code').eq('id', id).single()).data!
const tx = async (over: Record<string, unknown> = {}) =>
  (
    await adminClient()
      .from('toy_transactions')
      .insert({
        toy_id: toyId, type: 'exchange', status: 'accepted', requester_id: requester.id, owner_id: owner.id,
        owner_code: '111111', requester_code: '222222', ...over,
      })
      .select('id')
      .single()
  ).data!.id as string

beforeAll(async () => {
  owner = await createTestUser('contributor')
  requester = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  toyId = (
    await adminClient()
      .from('toys')
      .insert({ owner_id: owner.id, name: 'Drum', condition: 8, photo_urls: ['https://example.com/d.jpg'], offer_type: 'both', status: 'published' })
      .select('id')
      .single()
  ).data!.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('toy_id', toyId)
  await adminClient().from('toys').delete().eq('id', toyId)
  for (const u of [owner, requester, outsider]) await deleteTestUser(u.id)
})

describe('POST /api/toy-transactions/:id/new-code', () => {
  it("replaces the requester's code and leaves the owner's alone", async () => {
    const id = await tx()
    const res = await newCode(requester, id)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { requester_code: string; owner_code: string | null }
    expect(body.requester_code).toMatch(/^\d{6}$/)
    expect(body.owner_code).toBeNull()
    const after = await codes(id)
    expect(after.owner_code).toBe('111111')
    expect(after.requester_code).toBe(body.requester_code)
  })

  it("replaces the owner's code and never returns the requester's", async () => {
    const id = await tx()
    const res = await newCode(owner, id)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { owner_code: string; requester_code: string | null }
    expect(body.requester_code).toBeNull()
    expect((await codes(id)).requester_code).toBe('222222')
  })

  it('is refused to anyone outside the exchange', async () => {
    expect((await newCode(outsider, await tx())).status).toBe(404)
  })

  it('is refused before the request is accepted', async () => {
    expect((await newCode(requester, await tx({ status: 'requested', owner_code: null, requester_code: null }))).status).toBe(409)
  })

  it('is refused once the other side has already typed your code in', async () => {
    // The owner confirms with the requester's code, so the requester's code is spent.
    const id = await tx({ owner_confirmed_at: new Date().toISOString() })
    expect((await newCode(requester, id)).status).toBe(409)
    expect((await codes(id)).requester_code).toBe('222222')
  })

  it('is refused when the other side types your code in while the new one is being made', async () => {
    const id = await tx()
    between.run = async () => {
      await adminClient().from('toy_transactions').update({ owner_confirmed_at: new Date().toISOString() }).eq('id', id)
    }
    expect((await newCode(requester, id)).status).toBe(409)
    expect((await codes(id)).requester_code).toBe('222222')
  })
})
