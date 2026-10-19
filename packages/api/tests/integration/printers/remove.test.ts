/**
 * Removing a printer: the owner's own machine goes, someone else's is "no such
 * printer", and one that jobs name stays put with a sentence saying why.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let stranger: TestUser
let tutorialId: string
const printerIds: string[] = []

const del = (u: TestUser, id: string) =>
  app.request(`/api/printers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${u.token}` } })

async function printer(name: string) {
  const { data } = await adminClient()
    .from('printers')
    .insert({ owner_id: owner.id, name, materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  printerIds.push(data!.id)
  return data!.id as string
}

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  const { data } = await adminClient()
    .from('tutorials')
    .insert({ title: 'Remove fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = data!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().in('id', printerIds)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([family, owner, stranger].map((u) => deleteTestUser(u.id)))
})

describe('DELETE /api/printers/:id', () => {
  it('WR24 removes the owner’s printer and nobody else’s', async () => {
    const id = await printer('Garage Ender')

    const byStranger = await del(stranger, id)
    expect(byStranger.status).toBe(404)
    expect(await byStranger.json()).toEqual({ error: 'No such printer of yours.' })
    expect((await adminClient().from('printers').select('id').eq('id', id)).data).toHaveLength(1)

    const byOwner = await del(owner, id)
    expect(byOwner.status).toBe(200)
    expect(await byOwner.json()).toEqual({ id })
    expect((await adminClient().from('printers').select('id').eq('id', id)).data).toEqual([])
  })

  it('WR24 keeps a printer that a job names, and says to close it instead', async () => {
    const id = await printer('Busy Bambu')
    await adminClient().from('toy_transactions').insert({
      type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: id, requester_id: family.id,
      owner_id: owner.id, print_group_id: crypto.randomUUID(),
    })

    const res = await del(owner, id)
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe(
      'This printer has jobs on its record, and they name it. Close it to new jobs instead of removing it.'
    )
    expect((await adminClient().from('printers').select('id').eq('id', id)).data).toHaveLength(1)
  })
})
