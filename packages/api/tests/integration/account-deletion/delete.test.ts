/**
 * DELETE /api/me against a seeded account (083 + routes/me.ts). Each assertion
 * is one line of the spec's table: what goes, what is repointed to the
 * "Deleted member" placeholder, and what other people keep.
 */
// journeys: Z05
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const GHOST = '00000000-0000-4000-8000-00000000dead'
const del = (token: string, body: unknown) => ({
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

let leaving: TestUser
let other: TestUser
const ids: Record<string, string> = {}

beforeAll(async () => {
  leaving = await createTestUser()
  other = await createTestUser()
  const admin = adminClient()
  await admin.from('profiles').update({ name: 'Sam Leaving' }).eq('id', leaving.id)

  const toy = (name: string) =>
    admin.from('toys').insert({
      owner_id: leaving.id, name, condition: 7, photo_urls: ['https://example.invalid/a.jpg'],
      offer_type: 'donation', status: 'published',
    }).select('id').single()
  ids.sharedToy = (await toy('Shared spinner')).data!.id
  ids.loneToy = (await toy('Lone rattle')).data!.id

  // Open: the other person asked for the shared toy.
  ids.openTx = (await admin.from('toy_transactions').insert({
    toy_id: ids.sharedToy, type: 'donation', status: 'requested',
    requester_id: other.id, owner_id: leaving.id, pickup_line1: '1 Private St',
  }).select('id').single()).data!.id

  const guide = (title: string, status: string) =>
    admin.from('tutorials').insert({ title, difficulty: 'easy', status }).select('id').single()
  ids.draft = (await guide('Solo draft', 'draft')).data!.id
  ids.published = (await guide('Published guide', 'approved')).data!.id
  await admin.from('tutorial_contributors').insert([
    { tutorial_id: ids.draft, profile_id: leaving.id },
    { tutorial_id: ids.published, profile_id: leaving.id },
  ])

  // A post in someone else's challenge: 038's NO ACTION used to block deletion.
  ids.idea = (await admin.from('toy_ideas').insert({
    author_id: other.id, title: 'Weighted spoon', summary: 'S', description: 'D',
    intended_use: 'U', primary_user: 'P', status: 'challenge',
  }).select('id').single()).data!.id
  ids.msg = (await admin.from('toy_idea_messages').insert({
    idea_id: ids.idea, sender_id: leaving.id, kind: 'user', body: 'Try a zip pocket.',
  }).select('id').single()).data!.id

  await admin.from('child_profiles').insert({ parent_id: leaving.id, age: 5 })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_ideas').delete().eq('id', ids.idea)
  await admin.from('toy_transactions').delete().eq('id', ids.openTx)
  await admin.from('toys').delete().eq('id', ids.sharedToy)
  await admin.from('tutorials').delete().eq('id', ids.published)
  if (ids.org) await admin.from('organizations').delete().eq('id', ids.org)
  await deleteTestUser(other.id)
})

describe('DELETE /api/me', () => {
  it('refuses without the typed confirmation', async () => {
    const res = await app.request('/api/me', del(leaving.token, { confirm: 'delete' }))
    expect(res.status).toBe(400)
  })

  it('previews what would happen', async () => {
    const res = await app.request('/api/me/deletion', { headers: { Authorization: `Bearer ${leaving.token}` } })
    const body = (await res.json()) as { open: unknown[]; childProfiles: number; publishedGuides: number }
    expect(body.open).toHaveLength(1)
    expect(body.childProfiles).toBe(1)
    expect(body.publishedGuides).toBe(1)
  })

  it('refuses the only leader of an organisation', async () => {
    const admin = adminClient()
    ids.org = (await admin.from('organizations').insert({ name: `Solo org ${Date.now()}`, status: 'active' }).select('id').single()).data!.id
    await admin.from('org_leaders').insert({ org_id: ids.org, user_id: leaving.id })
    const res = await app.request('/api/me', del(leaving.token, { confirm: 'DELETE' }))
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe('sole_leader')
    await admin.from('org_leaders').delete().eq('org_id', ids.org)
  })

  it('deletes the person and keeps what other people rely on', async () => {
    const res = await app.request('/api/me', del(leaving.token, { confirm: 'DELETE', keepCredit: true }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ emailed: false }) // no RESEND_API_KEY locally
    const admin = adminClient()

    // Gone.
    expect((await admin.from('profiles').select('id').eq('id', leaving.id)).data).toHaveLength(0)
    expect((await admin.from('child_profiles').select('id').eq('parent_id', leaving.id)).data).toHaveLength(0)
    expect((await admin.from('toys').select('id').eq('id', ids.loneToy)).data).toHaveLength(0)
    expect((await admin.from('tutorials').select('id').eq('id', ids.draft)).data).toHaveLength(0)

    // The open request was cancelled, the other person told, the address erased.
    const { data: tx } = await admin.from('toy_transactions').select('status, owner_id, pickup_line1').eq('id', ids.openTx).single()
    expect(tx).toEqual({ status: 'rejected', owner_id: GHOST, pickup_line1: null })
    const { data: notes } = await admin.from('notifications').select('type').eq('recipient_id', other.id).eq('toy_transaction_id', ids.openTx)
    expect(notes).toEqual([{ type: 'toy_rejected' }])

    // Kept, without the person.
    const { data: toy } = await admin.from('toys').select('owner_id, status').eq('id', ids.sharedToy).single()
    expect(toy).toEqual({ owner_id: GHOST, status: 'draft' })
    const { data: msg } = await admin.from('toy_idea_messages').select('sender_id').eq('id', ids.msg).single()
    expect(msg!.sender_id).toBe(GHOST)
    const { data: credit } = await admin.from('tutorial_contributors').select('profile_id, former_names, former_count').eq('tutorial_id', ids.published).single()
    expect(credit).toEqual({ profile_id: GHOST, former_names: ['Sam Leaving'], former_count: 1 })

    // The public guide shows the name they chose to keep.
    const pub = await app.request(`/api/public/tutorials/${ids.published}`)
    const body = (await pub.json()) as { tutorial_contributors: { profiles: { name: string } }[] }
    expect(body.tutorial_contributors[0]!.profiles.name).toBe('Sam Leaving')
  })

  it('leaves an account that can no longer sign in', async () => {
    const { data } = await adminClient().auth.admin.getUserById(leaving.id)
    expect(data.user).toBeNull()
  })
})

describe('two co-authors leaving one guide', () => {
  it('keeps both in one credit: the name kept, the other counted', async () => {
    const [a, b] = await Promise.all([createTestUser(), createTestUser()])
    const admin = adminClient()
    await admin.from('profiles').update({ name: 'Ana Kept' }).eq('id', a.id)
    const guide = (await admin.from('tutorials').insert({ title: 'Two authors', difficulty: 'easy', status: 'approved' }).select('id').single()).data!.id
    await admin.from('tutorial_contributors').insert([
      { tutorial_id: guide, profile_id: a.id },
      { tutorial_id: guide, profile_id: b.id },
    ])

    expect((await app.request('/api/me', del(a.token, { confirm: 'DELETE', keepCredit: true }))).status).toBe(200)
    expect((await app.request('/api/me', del(b.token, { confirm: 'DELETE', keepCredit: false }))).status).toBe(200)

    const { data } = await admin.from('tutorial_contributors').select('profile_id, former_names, former_count').eq('tutorial_id', guide)
    expect(data).toEqual([{ profile_id: GHOST, former_names: ['Ana Kept'], former_count: 2 }])
    const pub = (await (await app.request(`/api/public/tutorials/${guide}`)).json()) as {
      tutorial_contributors: { profiles: { name: string } }[]
    }
    expect(pub.tutorial_contributors[0]!.profiles.name).toBe('Ana Kept and 1 former contributor')
    await admin.from('tutorials').delete().eq('id', guide)
  })
})

// 106: an idea's photo path names its author's folder. Deletion repoints the
// idea to the placeholder, so the folder check must still let the row through.
describe('a member with an idea photo leaving', () => {
  it('deletes the account and keeps the idea, photo and all, under the placeholder', async () => {
    const author = await createTestUser()
    const admin = adminClient()
    const photo = `ideas/${author.id}/${crypto.randomUUID()}.jpg`
    const { data: idea, error } = await admin
      .from('toy_ideas')
      .insert({ author_id: author.id, title: 'Photo idea', summary: 'S', status: 'challenge', photo_path: photo })
      .select('id')
      .single()
    expect(error).toBeNull()

    expect((await app.request('/api/me', del(author.token, { confirm: 'DELETE' }))).status).toBe(200)

    const { data } = await admin.from('toy_ideas').select('author_id, photo_path').eq('id', idea!.id).single()
    expect(data).toEqual({ author_id: GHOST, photo_path: photo })
    await admin.from('toy_ideas').delete().eq('id', idea!.id)
  })
})
