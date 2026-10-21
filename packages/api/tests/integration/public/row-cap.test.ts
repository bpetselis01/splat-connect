// journeys: (none — route coverage; PostgREST 1000-row cap, no journey row)
/** Public lists and catalogues keep every row once a table passes PostgREST's 1000-row response cap. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const CAP = 1000
const stamp = crypto.randomUUID().slice(0, 8)
const admin = adminClient()
let creator: TestUser
let guide: string

const headCount = async (table: string, filter?: [string, string]) => {
  const q = admin.from(table).select('id', { count: 'exact', head: true })
  const { count, error } = await (filter ? q.eq(...filter) : q)
  if (error) throw new Error(error.message)
  return count!
}
const approvedStl = async () =>
  (await admin.from('stl_files').select('id, tutorials!inner(status)', { count: 'exact', head: true }).eq('tutorials.status', 'approved')).count!
const filler = async (table: string, have: number, row: (i: number) => object) => {
  const rows = Array.from({ length: Math.max(0, CAP + 1 - have) }, (_, i) => row(i))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from(table).insert(rows.slice(i, i + 500))
    if (error) throw new Error(`seed ${table}: ${error.message}`)
  }
}

beforeAll(async () => {
  creator = await createTestUser('admin')
  guide = (await admin.from('tutorials').insert({ title: `Cap guide ${stamp}`, description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()).data!.id as string
  await filler('stl_files', await approvedStl(), (i) => ({ tutorial_id: guide, filename: `cap-${stamp}-${i}.stl`, file_url: `${guide}/${i}.stl` }))
  await filler('organizations', await headCount('organizations'), (i) => ({ name: `Cap Org ${stamp} ${i}`, created_by: creator.id, status: 'active' }))
})

afterAll(async () => {
  await admin.from('tutorials').delete().eq('id', guide)
  await admin.from('organizations').delete().like('name', `Cap Org ${stamp}%`)
  await deleteTestUser(creator.id)
})

describe('public lists past the 1000-row cap', () => {
  it('printable-parts totals every STL file of an approved guide', async () => {
    const body = (await (await app.request(`/api/public/printable-parts`)).json()) as { total: number }
    expect(body.total).toBe(await approvedStl())
  })

  it('the organisation directory lists every organisation', async () => {
    const list = (await (await app.request('/api/public/organizations')).json()) as unknown[]
    expect(list).toHaveLength(await headCount('organizations'))
  })

  it('the guide library lists every approved guide', async () => {
    const list = (await (await app.request('/api/public/tutorials')).json()) as unknown[]
    expect(list).toHaveLength(await headCount('tutorials', ['status', 'approved']))
  })
})
