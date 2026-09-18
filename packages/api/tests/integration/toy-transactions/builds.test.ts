/**
 * Build requests: the whole loop, and the three rules that make the extra stage
 * worth having.
 *
 * - **The family approves before the handover.** Confirming past an unapproved
 *   working shot would close a build the person it was made for has never seen.
 * - **The maker posts the shot, the family approves it.** Either side doing the
 *   other's half is the stage approving itself.
 * - **Reposting resets the approval.** An approval carried onto a different
 *   photo closes the stage with nobody having looked at what is on the record.
 *
 * Also asserts the two things 057 changed underneath: a build accepts (033's
 * capacity lock used to answer `missing` when there was no toy to lock) and
 * completing one transfers nothing, because the maker made the thing and there
 * is no toy row to move.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let maker: TestUser
let outsider: TestUser
let tutorialId: string
let transactionId: string

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const json = (token: string, body: unknown) => ({
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const photo = (token: string) => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' }))
  return { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
}

beforeAll(async () => {
  family = await createTestUser('contributor')
  maker = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  const admin = adminClient()

  // 034 made the public profile opt-OUT, so the maker is already addressable.
  // The outsider opts out, which is the case the gate exists for: somebody who
  // has said they do not want a public profile cannot be sent a build request.
  await admin.from('profiles').update({ public_showcase: false }).eq('id', outsider.id)

  const { data: tutorial } = await admin
    .from('tutorials')
    .insert({
      title: 'Bubble machine, switch adapted',
      description: 'A guide',
      difficulty: 'easy',
      status: 'approved',
    })
    .select('id')
    .single()
  tutorialId = tutorial!.id
  await admin.from('tutorial_contributors').insert({
    tutorial_id: tutorialId,
    profile_id: maker.id,
    role: 'author',
  })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([
    deleteTestUser(family.id),
    deleteTestUser(maker.id),
    deleteTestUser(outsider.id),
  ])
})

describe('asking for a build', () => {
  it('creates a transaction with a guide for a subject and no toy', async () => {
    const res = await app.request(
      '/api/toy-transactions/build',
      json(family.token, {
        tutorial_id: tutorialId,
        maker_id: maker.id,
        build_brief: 'For Leo, 3. He uses a 100 mm button switch.',
      })
    )
    expect(res.status).toBe(201)
    const tx = (await res.json()) as {
      id: string
      type: string
      toy_id: string | null
      tutorial_id: string
      owner_id: string
      status: string
    }
    expect(tx.type).toBe('build')
    expect(tx.toy_id).toBeNull()
    expect(tx.tutorial_id).toBe(tutorialId)
    expect(tx.owner_id).toBe(maker.id)
    expect(tx.status).toBe('requested')
    transactionId = tx.id
  })

  it('refuses a second open ask for the same guide and maker', async () => {
    const res = await app.request(
      '/api/toy-transactions/build',
      json(family.token, {
        tutorial_id: tutorialId,
        maker_id: maker.id,
        build_brief: 'Same again',
      })
    )
    expect(res.status).toBe(409)
  })

  /*
   * Why: letting one account address a request to any other by id is a spam
   * hole. Somebody who opted out is not addressable, and the refusal must not
   * say which of "no such account" and "opted out" it is.
   */
  it('refuses a maker who has opted out of a public profile', async () => {
    const res = await app.request(
      '/api/toy-transactions/build',
      json(family.token, {
        tutorial_id: tutorialId,
        maker_id: outsider.id,
        build_brief: 'Not addressable',
      })
    )
    expect(res.status).toBe(404)
  })

  it('refuses an empty brief and a maker who is both a person and an org', async () => {
    const blank = await app.request(
      '/api/toy-transactions/build',
      json(family.token, { tutorial_id: tutorialId, maker_id: maker.id, build_brief: '  ' })
    )
    expect(blank.status).toBe(400)

    const both = await app.request(
      '/api/toy-transactions/build',
      json(family.token, {
        tutorial_id: tutorialId,
        maker_id: maker.id,
        maker_org_id: '00000000-0000-0000-0000-000000000000',
        build_brief: 'Who is it for',
      })
    )
    expect(both.status).toBe(400)
  })
})

describe('the extra stage', () => {
  it('lets the maker accept, which 033 used to answer "missing" for', async () => {
    const res = await app.request(
      `/api/toy-transactions/${transactionId}/accept`,
      json(maker.token, {
        pickup_line1: '1 Test St',
        pickup_suburb: 'Testville',
        pickup_state: 'VIC',
        pickup_postcode: '3000',
      })
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { status: string }).status).toBe('accepted')
  })

  it('will not confirm a handover before the working shot is approved', async () => {
    const res = await app.request(
      `/api/toy-transactions/${transactionId}/confirm`,
      json(maker.token, { code: 'anything' })
    )
    expect(res.status).toBe(409)
  })

  it('refuses the family posting the shot and the maker approving it', async () => {
    const byFamily = await app.request(
      `/api/toy-transactions/${transactionId}/working-shot`,
      photo(family.token)
    )
    expect(byFamily.status).toBe(403)

    const posted = await app.request(
      `/api/toy-transactions/${transactionId}/working-shot`,
      photo(maker.token)
    )
    expect(posted.status).toBe(200)
    expect(((await posted.json()) as { working_photo_url: string }).working_photo_url).toContain(
      transactionId
    )

    const byMaker = await app.request(
      `/api/toy-transactions/${transactionId}/approve-work`,
      json(maker.token, {})
    )
    expect(byMaker.status).toBe(403)
  })

  it('lets the family approve, and refuses approving twice', async () => {
    const res = await app.request(
      `/api/toy-transactions/${transactionId}/approve-work`,
      json(family.token, {})
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { work_approved_at: string }).work_approved_at).not.toBeNull()

    const again = await app.request(
      `/api/toy-transactions/${transactionId}/approve-work`,
      json(family.token, {})
    )
    expect(again.status).toBe(409)
  })

  /*
   * Why: an approval carried onto a different photo closes the stage with
   * nobody having looked at what is now on the record.
   */
  it('clears the approval when a new shot replaces the old one', async () => {
    const res = await app.request(
      `/api/toy-transactions/${transactionId}/working-shot`,
      photo(maker.token)
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { work_approved_at: string | null }).work_approved_at).toBeNull()

    // Put it back so the completion below has something to close.
    await app.request(`/api/toy-transactions/${transactionId}/approve-work`, json(family.token, {}))
  })

  it('shows an outsider nothing of the build', async () => {
    const res = await app.request(`/api/toy-transactions/${transactionId}`, authed(outsider.token))
    expect(res.status).toBe(404)
  })
})

describe('closing a build', () => {
  it('completes on both codes and transfers no toy, because there is none', async () => {
    const admin = adminClient()
    const { data: row } = await admin
      .from('toy_transactions')
      .select('owner_code, requester_code')
      .eq('id', transactionId)
      .single()

    const byMaker = await app.request(
      `/api/toy-transactions/${transactionId}/confirm`,
      json(maker.token, { code: row!.requester_code })
    )
    expect(byMaker.status).toBe(200)

    const byFamily = await app.request(
      `/api/toy-transactions/${transactionId}/confirm`,
      json(family.token, { code: row!.owner_code })
    )
    expect(byFamily.status).toBe(200)
    expect(((await byFamily.json()) as { status: string }).status).toBe('completed')

    // 057's whole reason for not being a second table is that everything after
    // the accept is the existing code. This is the one place that code had to
    // learn a build has no toy: nothing was cloned, transferred or decremented.
    const { count } = await admin
      .from('toys')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', family.id)
    expect(count).toBe(0)
  })
})
