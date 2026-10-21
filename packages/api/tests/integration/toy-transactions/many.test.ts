/**
 * The Makers wanted board and the exchange list with more guides and print
 * groups than fit in one PostgREST URL (~300 uuids). The guide lookup used to
 * 500 the board, and the group-size lookup silently reported every request as
 * sent to one printer.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const COUNT = 350
const tag = `Tx Many ${Date.now()}`
const last = COUNT - 1
let family: TestUser
let orgId: string
let printerId: string
let guideIds: string[] = []
let groupIds: string[] = []

const get = (path: string) => app.request(`/api/toy-transactions${path}`, { headers: { Authorization: `Bearer ${family.token}` } })

beforeAll(async () => {
  family = await createTestUser('contributor')
  const sb = adminClient()
  const org = await sb.from('organizations').insert({ name: tag, status: 'active', suburb: 'Crows Nest', state: 'NSW' }).select('id').single()
  if (org.error) throw org.error
  orgId = org.data.id
  const printer = await sb
    .from('printers')
    .insert({ owner_org_id: orgId, name: `${tag} machine`, materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  if (printer.error) throw printer.error
  printerId = printer.data.id
  const guides = await sb
    .from('tutorials')
    .insert(Array.from({ length: COUNT }, (_, i) => ({ title: `${tag} guide ${i}`, description: 'A guide', difficulty: 'easy', status: 'approved' })))
    .select('id')
  if (guides.error) throw guides.error
  guideIds = guides.data.map((g) => g.id)
  groupIds = Array.from({ length: COUNT }, () => crypto.randomUUID())
  const print = (i: number) => ({
    type: 'print', status: 'requested', tutorial_id: guideIds[i], printer_id: printerId, requester_id: family.id,
    owner_id: null, owner_org_id: orgId, print_group_id: groupIds[i],
  })
  const { error } = await sb.from('toy_transactions').insert([
    ...guideIds.map((_, i) => print(i)),
    { ...print(last), tutorial_id: guideIds[0] },
    ...guideIds.map((tutorial_id) => ({ type: 'build', status: 'requested', tutorial_id, requester_id: family.id, build_brief: 'For Leo' })),
  ])
  if (error) throw error
})

afterAll(async () => {
  const sb = adminClient()
  for (let i = 0; i < COUNT; i += 100) await sb.from('toy_transactions').delete().in('tutorial_id', guideIds.slice(i, i + 100))
  await sb.from('printers').delete().eq('id', printerId)
  for (let i = 0; i < COUNT; i += 100) await sb.from('tutorials').delete().in('id', guideIds.slice(i, i + 100))
  await sb.from('organizations').delete().eq('id', orgId)
  await deleteTestUser(family.id)
})

describe('more than 300 guides and print groups', () => {
  it('names the guide on every open build request', async () => {
    const res = await get('/open-builds')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ tutorial: { id: string; title: string } | null }>
    expect(rows.find((r) => r.tutorial?.id === guideIds[last])!.tutorial!.title).toBe(`${tag} guide ${last}`)
  })

  it('reports how many printers a request went to', async () => {
    const res = await get('?role=requester')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ tutorial_id: string; print_group_id: string; print_group_size: number | null }>
    expect(rows.find((r) => r.print_group_id === groupIds[last] && r.tutorial_id === guideIds[last])!.print_group_size).toBe(2)
  })
})
