import { describe, it, expect, vi, beforeEach } from 'vitest'

/*
 * The recipient policy for the two review-queue notifications, tested against a
 * fake admin client rather than the database.
 *
 * Worth its own file because the policy is the whole feature: every branch here
 * fails silently in production if it is wrong. Too many recipients is a leader
 * being told about work their organisation never took on; too few is the exact
 * bug this feature exists to fix, and neither shows up as an error anywhere.
 */
const tables: Record<string, { list?: unknown[]; single?: unknown }> = {}
const inserted: Record<string, unknown>[] = []

/** A stub that is both chainable (.select/.eq/.in return itself) and awaitable,
    so it stands in for a PostgREST builder however the caller ends the chain. */
function builder(table: string): unknown {
  const rows = () => ({ data: tables[table]?.list ?? [], error: null })
  const one = () => ({ data: tables[table]?.single ?? null, error: null })
  const proxy: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(rows()).then(res)
        if (prop === 'maybeSingle' || prop === 'single') return async () => one()
        if (prop === 'insert')
          return async (batch: Record<string, unknown>[]) => {
            inserted.push(...batch)
            return { error: null }
          }
        return () => proxy
      },
    }
  )
  return proxy
}

vi.mock('../../src/supabase/client.js', () => ({
  createAdminClient: () => ({ from: (table: string) => builder(table) }),
}))

const { notifyBackingRequested, notifyTutorialSubmitted } = await import(
  '../../src/review-notifications.js'
)

const AUTHOR = 'author-1'

beforeEach(() => {
  inserted.length = 0
  for (const k of Object.keys(tables)) delete tables[k]
  tables.profiles = { single: { name: 'Dana' }, list: [] }
  tables.tutorials = { single: { title: 'Spoon Holder' } }
})

const recipients = () => inserted.map((r) => r.recipient_id).sort()

describe('notifyTutorialSubmitted', () => {
  // Tests: a backed submission reaches the leaders of the backing orgs only
  // How:   two accepted backings, three leader rows across them
  // Chain: this is the notification the whole feature was asked for — a leader
  //        of an org backing the work learns it is waiting on them
  it('notifies the leaders of every accepted backing organisation', async () => {
    tables.tutorial_orgs = { list: [{ org_id: 'org-a' }, { org_id: 'org-b' }] }
    tables.org_leaders = { list: [{ user_id: 'lead-1' }, { user_id: 'lead-2' }] }

    await notifyTutorialSubmitted({ tutorialId: 't1', tutorialTitle: 'Spoon Holder', actorId: AUTHOR })

    expect(recipients()).toEqual(['lead-1', 'lead-2'])
    expect(inserted[0]).toMatchObject({
      type: 'tutorial_submitted',
      tutorial_id: 't1',
      tutorial_title: 'Spoon Holder',
      actor_name: 'Dana',
    })
  })

  // Tests: no accepted backing falls through to the admins
  // How:   empty tutorial_orgs, two admin profiles
  // Chain: an unbacked submission has no leader who will ever see it, so the
  //        admins are the only people who can act — this is the branch that
  //        stops such work sitting unreviewed forever
  it('notifies admins when nothing is backing the project', async () => {
    tables.tutorial_orgs = { list: [] }
    tables.profiles = { single: { name: 'Dana' }, list: [{ id: 'admin-1' }, { id: 'admin-2' }] }

    await notifyTutorialSubmitted({ tutorialId: 't1', tutorialTitle: 'Spoon Holder', actorId: AUTHOR })

    expect(recipients()).toEqual(['admin-1', 'admin-2'])
    expect(inserted[0]).toMatchObject({ type: 'tutorial_submitted' })
  })

  // Tests: admins are NOT told about a backed submission
  // How:   one accepted backing with one leader, plus an admin profile that
  //        would be picked up if the branch were an "or" rather than an "else"
  // Chain: the decision was that admins keep /admin/review as their pull list;
  //        notifying them on every submission is the same information twice
  it('leaves admins out when an organisation is backing the project', async () => {
    tables.tutorial_orgs = { list: [{ org_id: 'org-a' }] }
    tables.org_leaders = { list: [{ user_id: 'lead-1' }] }
    tables.profiles = { single: { name: 'Dana' }, list: [{ id: 'admin-1' }] }

    await notifyTutorialSubmitted({ tutorialId: 't1', tutorialTitle: 'Spoon Holder', actorId: AUTHOR })

    expect(recipients()).toEqual(['lead-1'])
  })

  // Tests: the author never notifies themselves, and no admin fallback rescues it
  // How:   the single leader of the single backing org IS the author
  // Chain: a therapist writing up their own service's work is a real case; the
  //        organisation did take it on, so falling through to the admins here
  //        would route around a review that is already correctly assigned
  it('sends nothing when the only backing leader is the author', async () => {
    tables.tutorial_orgs = { list: [{ org_id: 'org-a' }] }
    tables.org_leaders = { list: [{ user_id: AUTHOR }] }
    tables.profiles = { single: { name: 'Dana' }, list: [{ id: 'admin-1' }] }

    await notifyTutorialSubmitted({ tutorialId: 't1', tutorialTitle: 'Spoon Holder', actorId: AUTHOR })

    expect(inserted).toEqual([])
  })

  // Tests: one person leading two backing organisations gets one row
  // How:   org_leaders returns the same user_id twice
  // Chain: notifications.recipient_id has no uniqueness to lean on, so a
  //        duplicate would show as the same sentence twice in the inbox and
  //        count twice on the My SPLAT badge
  it('deduplicates a leader who leads two backing organisations', async () => {
    tables.tutorial_orgs = { list: [{ org_id: 'org-a' }, { org_id: 'org-b' }] }
    tables.org_leaders = { list: [{ user_id: 'lead-1' }, { user_id: 'lead-1' }] }

    await notifyTutorialSubmitted({ tutorialId: 't1', tutorialTitle: 'Spoon Holder', actorId: AUTHOR })

    expect(recipients()).toEqual(['lead-1'])
  })
})

describe('notifyBackingRequested', () => {
  // Tests: the asked organisation's leaders are told, with the project's title
  // How:   one org, two leaders; the title comes from the tutorials lookup
  // Chain: a backing request sat in tutorial_orgs as 'pending' with nothing
  //        telling the leader it had arrived
  it('notifies the leaders of the organisation that was asked', async () => {
    tables.org_leaders = { list: [{ user_id: 'lead-1' }, { user_id: 'lead-2' }] }

    await notifyBackingRequested({ tutorialId: 't1', orgId: 'org-a', actorId: AUTHOR })

    expect(recipients()).toEqual(['lead-1', 'lead-2'])
    expect(inserted[0]).toMatchObject({
      type: 'backing_requested',
      tutorial_id: 't1',
      tutorial_title: 'Spoon Holder',
      actor_name: 'Dana',
    })
  })

  // Tests: an author who leads the organisation they asked is not notified
  it('does not notify the author about their own request', async () => {
    tables.org_leaders = { list: [{ user_id: AUTHOR }] }

    await notifyBackingRequested({ tutorialId: 't1', orgId: 'org-a', actorId: AUTHOR })

    expect(inserted).toEqual([])
  })
})
