/** The parts catalogue: STL files from approved guides only, searched by filename and guide title. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient } from '../../helpers/auth.js'

const stamp = crypto.randomUUID().slice(0, 8)
let approved: string
let draft: string

beforeAll(async () => {
  const admin = adminClient()
  const guide = async (title: string, status: string) =>
    (await admin.from('tutorials').insert({ title, description: 'x', difficulty: 'easy', status }).select('id').single()).data!.id as string
  approved = await guide(`Catalogue guide ${stamp}`, 'approved')
  draft = await guide(`Catalogue draft ${stamp}`, 'draft')
  await admin.from('stl_files').insert([
    { tutorial_id: approved, filename: `cradle-${stamp}.stl`, file_url: `${approved}/c.stl`, filament_grams: 12, material: 'PETG', print_minutes: 45 },
    { tutorial_id: draft, filename: `secret-${stamp}.stl`, file_url: `${draft}/s.stl` },
  ], { defaultToNull: false })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [approved, draft])
})

const get = async (q: string) =>
  (await (await app.request(`/api/public/printable-parts?q=${encodeURIComponent(q)}`)).json()) as {
    items: Array<{ filename: string; tutorials: { title: string } }>
    total: number
    pages: number
  }

describe('GET /api/public/printable-parts', () => {
  it('finds a part by its filename, with its guide', async () => {
    const body = await get(`cradle-${stamp}`)
    expect(body.items.map((p) => [p.filename, p.tutorials.title])).toEqual([[`cradle-${stamp}.stl`, `Catalogue guide ${stamp}`]])
  })
  it('finds it by the guide’s title too', async () => {
    expect((await get(`Catalogue guide ${stamp}`)).total).toBe(1)
  })
  it('never lists a part from a guide that is not approved', async () => {
    expect((await get(`secret-${stamp}`)).total).toBe(0)
  })
  it('pages', async () => {
    const res = await app.request('/api/public/printable-parts?page=999')
    const body = (await res.json()) as { page: number; pages: number }
    expect(body.page).toBe(body.pages)
  })
})
