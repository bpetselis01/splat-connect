import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockFrom = vi.fn()

// Default admin-client stand-in for the join/leave/remove handlers, which look
// up the actor's name and write both the system message and a notification via
// the admin client (bypassing RLS, same as every other admin-backed route's
// unit tests). Reapplied in beforeEach so a test that overrides it doesn't leak
// into the next one; most tests don't assert on it, so this default covers them.
const mockAdminFrom = vi.fn()
function defaultAdminFrom(table: string) {
  if (table === 'profiles') {
    return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { name: 'Jamie' }, error: null }) }) }) }
  }
  return { insert: () => Promise.resolve({ data: null, error: null }) }
}

// --- Mock strategy ---
// Replaces the per-user Supabase client with one controlled fake so these tests
// exercise validation and status codes only. RLS itself is covered by the
// integration tests in tests/integration/toy-ideas/.
vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => ({ from: mockFrom }),
}))
vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
}))

const { default: toyIdeas } = await import('../../../src/routes/toy-ideas.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', toyIdeas)
  return app
}

const VALID = {
  title: 'Weighted spoon holder',
  summary: 'A holder that stops a spoon tipping',
  description: 'Long description of the problem',
  intended_use: 'Mealtimes at home, daily',
  primary_user: 'Six-year-old with limited grip',
  contact_prefs: ['co_design'],
}

function post(body: unknown) {
  return makeApp().request('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockFrom.mockReset()
  mockAdminFrom.mockReset()
  mockAdminFrom.mockImplementation(defaultAdminFrom)
})

describe('POST /ideas', () => {
  // Tests: every required narrative field must be present and non-blank
  // How:   posts VALID minus one field at a time; checks 400
  // Chain: a half-filled idea reaches an admin with nothing to judge → reviewers
  //        reject blindly and authors never learn why
  it.each(['title', 'summary', 'description', 'intended_use', 'primary_user'])(
    'rejects a missing %s',
    async (field) => {
      const body: Record<string, unknown> = { ...VALID }
      delete body[field]
      expect((await post(body)).status).toBe(400)
    }
  )

  // Tests: blank-but-present strings are rejected the same as missing ones
  // How:   posts a whitespace-only title
  // Chain: '   ' would otherwise pass a truthiness check and store an untitled idea
  it('rejects a whitespace-only field', async () => {
    expect((await post({ ...VALID, title: '   ' })).status).toBe(400)
  })

  // Tests: contact_prefs accepts only the three known values
  // How:   posts an unknown pref
  // Chain: an unvalidated array reaches the UI, which renders nothing for the
  //        unknown value and silently drops the author's stated involvement
  it('rejects an unknown contact pref', async () => {
    expect((await post({ ...VALID, contact_prefs: ['sabotage'] })).status).toBe(400)
  })

  // Tests: a valid submission is stored as the caller's own pending idea
  // How:   asserts the insert payload carries author_id from context, not the body
  // Chain: trusting a body-supplied author_id would let anyone submit as someone else
  it('stores the idea as pending, owned by the caller', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'idea-1' }, error: null })
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) })
    mockFrom.mockReturnValue({ insert })

    const res = await post({ ...VALID, author_id: 'somebody-else' })

    expect(res.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ author_id: 'user-1', status: 'pending' })
    )
  })
})

describe('POST /ideas/:id/join', () => {
  // Tests: a join writes both the participant row and a system message
  // How:   asserts inserts against both tables in one request
  // Chain: without the system message the author has no in-thread record that
  //        someone arrived — the notification is the only trace, and it is dismissible
  it('records the participant and announces it in the thread', async () => {
    // toy_idea_participants goes through the user client (RLS-checked); the
    // system message and notification go through the admin client — see the
    // fix note on systemMessage() for why.
    const inserts: Record<string, unknown[]> = { toy_idea_participants: [], toy_idea_messages: [] }
    mockFrom.mockImplementation((table: string) => ({
      insert: (payload: unknown) => {
        inserts[table]?.push(payload)
        return { select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }
      },
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'author-9', title: 'T', status: 'challenge' }, error: null }) }),
      }),
    }))
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return defaultAdminFrom(table)
      return {
        insert: (payload: unknown) => {
          inserts[table]?.push(payload)
          return Promise.resolve({ data: null, error: null })
        },
      }
    })

    const res = await makeApp().request('/idea-1/join', { method: 'POST' })

    expect(res.status).toBe(201)
    expect(inserts.toy_idea_participants).toHaveLength(1)
    expect(inserts.toy_idea_messages).toHaveLength(1)
  })

  // Tests: RLS rejection surfaces as 403, not 500
  // How:   makes the participant insert fail with Postgres' RLS violation code
  // Chain: joining a pending idea is blocked by policy; a 500 would read as a
  //        site fault rather than "you cannot join this"
  it('returns 403 when the policy refuses the join', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'a', title: 'T', status: 'pending' }, error: null }) }),
      }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { code: '42501', message: 'rls' } }) }) }),
    }))

    expect((await makeApp().request('/idea-1/join', { method: 'POST' })).status).toBe(403)
  })
})

describe('DELETE /ideas/:id/participants/:profileId', () => {
  // Tests: removing someone else is refused unless you authored the idea
  // How:   the idea's author is a different user; caller targets a third party
  // Chain: any participant could otherwise evict the others from a thread they joined
  it('refuses to remove a third party when the caller is not the author', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'someone-else', title: 'T', status: 'challenge' }, error: null }) }),
      }),
    }))

    const res = await makeApp().request('/idea-1/participants/user-2', { method: 'DELETE' })
    expect(res.status).toBe(403)
  })

  // Tests: a self-leave's system message is written with the admin client, not the caller's
  // How:   self-leave (target === caller, a non-author); the user-client mock throws if
  //        asked for toy_idea_messages at all, so the insert can only pass via mockAdminFrom
  // Chain: 038's insert policy needs sender_id to be the author or a *current* participant —
  //        by the time the message would be written the leaver's own participant row is
  //        already gone, so writing it as the user drops the author's only record of who left
  it('writes the self-leave system message with the admin client', async () => {
    const adminMessages: unknown[] = []
    mockFrom.mockImplementation((table: string) => {
      if (table === 'toy_idea_messages') throw new Error('system message must not use the user client')
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'author-9', title: 'T', status: 'challenge' }, error: null }) }),
        }),
        delete: () => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ profile_id: 'user-1' }], error: null }) }) }) }),
      }
    })
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return defaultAdminFrom(table)
      if (table === 'toy_idea_messages') {
        return {
          insert: (payload: unknown) => {
            adminMessages.push(payload)
            return Promise.resolve({ error: null })
          },
        }
      }
      return { insert: () => Promise.resolve({ data: null, error: null }) }
    })

    const res = await makeApp().request('/idea-1/participants/user-1', { method: 'DELETE' })

    expect(res.status).toBe(200)
    expect(adminMessages).toHaveLength(1)
  })

  // Tests: a self-leave with no participant row writes nothing, not a fabricated departure
  // How:   the delete matches zero rows (a legal no-op in Postgres, since 038's delete policy
  //        has no row to evaluate); asserts 404 and that neither the system message nor the
  //        notification insert ever fires
  // Chain: without checking the row count, any signed-in user could "leave" a challenge they
  //        never joined, and the author's thread would show a departure that never happened
  it('refuses a self-leave with no participant row and writes nothing', async () => {
    const adminInserts: Record<string, unknown[]> = { toy_idea_messages: [], notifications: [] }
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'author-9', title: 'T', status: 'challenge' }, error: null }) }),
      }),
      delete: () => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }) }),
    }))
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return defaultAdminFrom(table)
      return {
        insert: (payload: unknown) => {
          adminInserts[table]?.push(payload)
          return Promise.resolve({ data: null, error: null })
        },
      }
    })

    const res = await makeApp().request('/idea-1/participants/user-1', { method: 'DELETE' })

    expect(res.status).toBe(404)
    expect(adminInserts.toy_idea_messages).toHaveLength(0)
    expect(adminInserts.notifications).toHaveLength(0)
  })

  // Tests: an author "removing" someone who was never a participant sends no notification
  // How:   caller is the idea's author, target is a third profileId; the delete matches zero
  //        rows because no participant relationship ever existed to end
  // Chain: without the row check, an author could aim a "you were removed" notification at
  //        any profile id — an unsolicited notification to a real, uninvolved person, which
  //        on a platform serving families of disabled children is a safeguarding problem
  it('refuses to remove a profile that was never a participant', async () => {
    const adminInserts: Record<string, unknown[]> = { toy_idea_messages: [], notifications: [] }
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'user-1', title: 'T', status: 'challenge' }, error: null }) }),
      }),
      delete: () => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }) }),
    }))
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return defaultAdminFrom(table)
      return {
        insert: (payload: unknown) => {
          adminInserts[table]?.push(payload)
          return Promise.resolve({ data: null, error: null })
        },
      }
    })

    const res = await makeApp().request('/idea-1/participants/user-2', { method: 'DELETE' })

    expect(res.status).toBe(404)
    expect(adminInserts.toy_idea_messages).toHaveLength(0)
    expect(adminInserts.notifications).toHaveLength(0)
  })

  // Tests: an author's successful removal of a real participant names the
  //        *removed* person in the system message and notifies that same
  //        person with an actor_name of the *remover* — two different
  //        people, proven not collapsed into one
  // How:   caller is the idea's author (user-1); target (user-2) is a genuine
  //        participant, so the delete matches one row. mockAdminFrom's
  //        'profiles' lookup returns a name keyed by which id was queried,
  //        so a bug that reused one actorName() result for both roles would
  //        surface as the wrong name in the wrong place
  // Chain: systemMessage() is called with actorId = userId (the remover) but
  //        a body naming the removed person; the notification recipient is
  //        the removed person but actor_name is the remover. Swapping either
  //        pairing would tell the removed person they removed themselves, or
  //        write a thread record crediting the wrong person's departure
  it("names the removed person in the thread and the remover in that person's notification", async () => {
    const adminInserts: Record<string, unknown[]> = { toy_idea_messages: [], notifications: [] }
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'user-1', title: 'T', status: 'challenge' }, error: null }) }),
      }),
      delete: () => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ profile_id: 'user-2' }], error: null }) }) }) }),
    }))
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              single: () =>
                Promise.resolve({
                  data: { name: id === 'user-1' ? 'Alex the author' : 'Riley the removed' },
                  error: null,
                }),
            }),
          }),
        }
      }
      return {
        insert: (payload: unknown) => {
          adminInserts[table]?.push(payload)
          return Promise.resolve({ data: null, error: null })
        },
      }
    })

    const res = await makeApp().request('/idea-1/participants/user-2', { method: 'DELETE' })

    expect(res.status).toBe(200)
    expect(adminInserts.toy_idea_messages).toEqual([
      expect.objectContaining({ body: 'Riley the removed was removed from this challenge' }),
    ])
    expect(adminInserts.notifications).toEqual([
      expect.objectContaining({
        recipient_id: 'user-2',
        type: 'challenge_removed',
        actor_name: 'Alex the author',
      }),
    ])
  })
})

describe('POST /ideas/:id/reports', () => {
  function postReport(body: unknown) {
    return makeApp().request('/idea-1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  // The target-validation query: select ... .eq('idea_id', ...).eq('profile_id',
  // val).is('removed_at', null).maybeSingle() — resolves a row only when val
  // is in `participants`, matching a real current-participant lookup.
  function participantsTable(participants: string[]) {
    return {
      select: () => ({
        eq: () => ({
          eq: (_col: string, val: string) => ({
            is: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: participants.includes(val) ? { profile_id: val } : null, error: null }),
            }),
          }),
        }),
      }),
    }
  }

  function mockIdea(authorId: string, participants: string[] = ['user-2']) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'toy_ideas') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { author_id: authorId, title: 'T', status: 'challenge' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'toy_idea_participants') return participantsTable(participants)
      if (table === 'toy_idea_reports') {
        return { insert: () => Promise.resolve({ error: null }) }
      }
      throw new Error(`unexpected table ${table}`)
    })
  }

  // Tests: a blank or whitespace-only reason is rejected before any DB call
  // How:   posts a target profile with reason omitted, then whitespace-only
  // Chain: the owner's explicit call — a report with no account of what
  //        happened gives an admin nothing to act on and no pattern to compare
  it.each([{ reported_profile_id: 'user-2' }, { reported_profile_id: 'user-2', reason: '   ' }])(
    'rejects a blank reason',
    async (body) => {
      const res = await postReport(body)
      expect(res.status).toBe(400)
      expect(mockFrom).not.toHaveBeenCalled()
    }
  )

  // Tests: a missing target profile is rejected the same as a missing reason
  // How:   posts a reason with no reported_profile_id
  // Chain: without a target the removal step below has nothing to act on
  it('rejects a missing reported_profile_id', async () => {
    const res = await postReport({ reason: 'Made my child uncomfortable' })
    expect(res.status).toBe(400)
  })

  // Tests: RLS refusing the insert (not a current participant or the author)
  //        surfaces as 403, not 500
  // How:   the insert into toy_idea_reports returns Postgres' RLS code
  // Chain: 041/042's own insert policy is the permission check — someone who
  //        never joined this challenge must not be able to file a report on it
  it('returns 403 when the caller is not a participant', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'toy_ideas') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'author-9', title: 'T', status: 'challenge' }, error: null }) }) }) }
      }
      if (table === 'toy_idea_participants') return participantsTable(['user-2'])
      return { insert: () => Promise.resolve({ error: { code: '42501', message: 'rls' } }) }
    })

    const res = await postReport({ reported_profile_id: 'user-2', reason: 'Upsetting message' })
    expect(res.status).toBe(403)
  })

  // Tests: the same 403 path covers a *removed* participant trying to report —
  //        042 rewrote the insert policy to require removed_at is null, so a
  //        removed row's insert attempt fails RLS exactly like a stranger's
  // How:   same RLS-code mock as the previous test; documents the distinct
  //        scenario the route must not distinguish itself (the DB does)
  // Chain: without 042's fix a removed person could file reports against the
  //        very challenge that excluded them
  it('returns 403 when the caller is a removed participant', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'toy_ideas') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { author_id: 'author-9', title: 'T', status: 'challenge' }, error: null }) }) }) }
      }
      if (table === 'toy_idea_participants') return participantsTable(['user-2'])
      return { insert: () => Promise.resolve({ error: { code: '42501', message: 'rls' } }) }
    })

    const res = await postReport({ reported_profile_id: 'user-2', reason: 'Upsetting message' })
    expect(res.status).toBe(403)
  })

  // Tests: reporting a fellow participant removes that participant, not the
  //        reporter
  // How:   target 'user-2' is not the idea's author; asserts the admin update
  //        against toy_idea_participants filters on user-2's profile id
  // Chain: this is the baseline the author-exception test below is compared
  //        against — get this wrong and every report would misfire its removal
  it('removes the reported participant when the target is not the author', async () => {
    mockIdea('author-9')
    const updates: Array<{ payload: unknown; profileId: string }> = []
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return defaultAdminFrom(table)
      if (table === 'toy_idea_participants') {
        return {
          update: (payload: unknown) => ({
            eq: () => ({
              eq: (_col: string, val: string) => {
                updates.push({ payload, profileId: val })
                return Promise.resolve({ error: null })
              },
            }),
          }),
        }
      }
      return { insert: () => Promise.resolve({ data: null, error: null }) }
    })

    const res = await postReport({ reported_profile_id: 'user-2', reason: 'Upsetting message' })

    expect(res.status).toBe(201)
    expect(updates).toEqual([
      expect.objectContaining({ profileId: 'user-2', payload: expect.objectContaining({ removed_by: 'user-1' }) }),
    ])
  })

  // Tests: reporting the idea's author removes the *reporter* instead — an
  //        author cannot be evicted from their own idea
  // How:   target equals the idea's own author_id; asserts the admin update
  //        filters on the reporter's own id (user-1), never the author's
  // Chain: the owner's explicit design — someone uncomfortable enough to
  //        report should not be left sitting in the thread either, and an
  //        admin decides what happens to the challenge from there
  it('removes the reporter, not the author, when reporting the author', async () => {
    mockIdea('author-9')
    const updates: Array<{ profileId: string }> = []
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return defaultAdminFrom(table)
      if (table === 'toy_idea_participants') {
        return {
          update: () => ({
            eq: () => ({
              eq: (_col: string, val: string) => {
                updates.push({ profileId: val })
                return Promise.resolve({ error: null })
              },
            }),
          }),
        }
      }
      return { insert: () => Promise.resolve({ data: null, error: null }) }
    })

    const res = await postReport({ reported_profile_id: 'author-9', reason: 'Upsetting message' })

    expect(res.status).toBe(201)
    expect(updates).toEqual([{ profileId: 'user-1' }])
  })

  // Tests: the report's reason text reaches neither the thread's system
  //        message nor the removed person's notification — the single most
  //        important property of this endpoint
  // How:   posts a distinctive reason string; captures both the admin-client
  //        message insert and the notification insert; asserts neither
  //        payload's stringified form contains that reason anywhere
  // Chain: 041 gives toy_idea_reports no select policy specifically to keep
  //        this text away from the reported person — a leak here through the
  //        system message or notification would defeat that entirely
  it('keeps the report reason out of the system message and the notification', async () => {
    mockIdea('author-9')
    const reason = 'They said something that made my child very uncomfortable'
    const adminInserts: Record<string, unknown[]> = { toy_idea_messages: [], notifications: [] }
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return defaultAdminFrom(table)
      if (table === 'toy_idea_participants') {
        return { update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }) }
      }
      return {
        insert: (payload: unknown) => {
          adminInserts[table]?.push(payload)
          return Promise.resolve({ data: null, error: null })
        },
      }
    })

    const res = await postReport({ reported_profile_id: 'user-2', reason })

    expect(res.status).toBe(201)
    expect(adminInserts.toy_idea_messages).toHaveLength(1)
    expect(adminInserts.notifications).toHaveLength(1)
    expect(JSON.stringify(adminInserts.toy_idea_messages[0])).not.toContain(reason)
    expect(JSON.stringify(adminInserts.notifications[0])).not.toContain(reason)
    // The response the reporter themselves reads back must not echo it either.
    expect(JSON.stringify(await res.json())).not.toContain(reason)
  })

  // Tests: a target with no relationship to this idea (not the author, not a
  //        current participant) is refused before anything is written — no
  //        report row, no system message, no notification
  // How:   target 'nobody' is absent from mockIdea's participant list;
  //        asserts 404 and that toy_idea_reports is never inserted into, and
  //        that both admin-client writes stay empty
  // Chain: 041's insert policy validates only the *reporter's* relationship
  //        to the idea, never the target's — unchecked, anyone with one
  //        legitimate relationship anywhere on the platform could file a
  //        report naming an arbitrary, unrelated profile, and the code would
  //        still write a system message and a bogus "you were removed"
  //        notification to a real person who was never part of this challenge
  it('rejects a target with no relationship to the idea and writes nothing', async () => {
    mockIdea('author-9', ['user-2'])
    const adminInserts: Record<string, unknown[]> = { toy_idea_messages: [], notifications: [] }
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return defaultAdminFrom(table)
      return {
        insert: (payload: unknown) => {
          adminInserts[table]?.push(payload)
          return Promise.resolve({ data: null, error: null })
        },
        update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
      }
    })

    const res = await postReport({ reported_profile_id: 'nobody', reason: 'Upsetting message' })

    expect(res.status).toBe(404)
    expect(mockFrom).not.toHaveBeenCalledWith('toy_idea_reports')
    expect(adminInserts.toy_idea_messages).toHaveLength(0)
    expect(adminInserts.notifications).toHaveLength(0)
  })

  // Tests: the removed person's notification names 'SPLAT' as the actor, not
  //        the reporter
  // How:   captures the notification insert and asserts actor_name directly
  // Chain: the whole point of routing through a report rather than a direct
  //        block is that the reporter is never named to the person they
  //        reported — the reporter's own name here would render verbatim as
  //        "{actor_name} removed you from a design challenge" to that person
  it("names 'SPLAT', not the reporter, as the notification's actor", async () => {
    mockIdea('author-9')
    const adminInserts: Record<string, unknown[]> = { notifications: [] }
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return defaultAdminFrom(table)
      if (table === 'toy_idea_participants') {
        return { update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }) }
      }
      return {
        insert: (payload: unknown) => {
          adminInserts[table]?.push(payload)
          return Promise.resolve({ data: null, error: null })
        },
      }
    })

    const res = await postReport({ reported_profile_id: 'user-2', reason: 'Upsetting message' })

    expect(res.status).toBe(201)
    expect(adminInserts.notifications).toEqual([
      expect.objectContaining({ recipient_id: 'user-2', type: 'challenge_removed', actor_name: 'SPLAT' }),
    ])
  })
})

describe('GET /ideas/:id/messages', () => {
  // Tests: a non-participant's read goes through the user client only, comes back
  //        ordered oldest-first, and reads as an empty thread rather than an error
  // How:   mocks the user-client chain to return [] (what RLS produces for a
  //        non-participant) and spies on .eq()/.order() to pin the query shape;
  //        asserts the admin mock is never touched for this read
  // Chain: a swapped-in admin client here would defeat RLS silently, since every
  //        other test would still pass; a dropped .order() lets Postgres return the
  //        thread in undefined order and scrambles the conversation on render; and
  //        treating [] as an error would turn a public challenge page into an error
  //        page for anyone who is not a participant
  it('reads via the user client, ordered oldest-first, and returns [] for a non-participant', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    mockFrom.mockReturnValue({ select })

    const res = await makeApp().request('/idea-1/messages')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(mockFrom).toHaveBeenCalledWith('toy_idea_messages')
    expect(eq).toHaveBeenCalledWith('idea_id', 'idea-1')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(mockAdminFrom).not.toHaveBeenCalled()
  })
})

describe('GET /ideas/joined', () => {
  // Tests: the query scopes to the caller's own id from the verified token —
  //        never anything client-supplied — and returns the joined ideas
  //        themselves, not the participant rows the join goes through
  // How:   mocks the user-client chain and asserts .eq('profile_id', ...) is
  //        called with 'user-1', the id makeApp's auth stub puts on the
  //        token, then checks the embedded toy_ideas row is unwrapped; also
  //        asserts the admin mock is never touched, same as the messages
  //        read test above
  // Chain: same integrity property as POST / ignoring a body-supplied
  //        author_id — this route reads no request field for whose list to
  //        return, only the authenticated identity, so a regression that let
  //        anything else reach .eq() would let one account read another's
  //        joined-challenge list. A swapped-in admin client here would defeat
  //        RLS silently on a query that is supposed to be scoped by it.
  it("scopes to the token's own id and unwraps the joined idea", async () => {
    const idea = { id: 'idea-1', title: 'Big-button remote', status: 'challenge' }
    const order = vi.fn().mockResolvedValue({ data: [{ toy_ideas: idea }], error: null })
    const is = vi.fn().mockReturnValue({ order })
    const eq = vi.fn().mockReturnValue({ is })
    const select = vi.fn().mockReturnValue({ eq })
    mockFrom.mockReturnValue({ select })

    const res = await makeApp().request('/joined')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([idea])
    expect(mockFrom).toHaveBeenCalledWith('toy_idea_participants')
    // Explicit columns, not toy_ideas!inner(*) — IMPORTANT 3 of the
    // whole-branch review: a participant is never entitled to review_note,
    // which the author's own private rejection reasoning.
    expect(select).toHaveBeenCalledWith(
      'toy_ideas!inner(id, author_id, title, summary, description, intended_use, primary_user, contact_prefs, status, tutorial_id, created_at, updated_at)'
    )
    expect(select.mock.calls[0][0]).not.toContain('review_note')
    expect(eq).toHaveBeenCalledWith('profile_id', 'user-1')
    // 042: a removed row must not keep showing the caller a challenge they
    // were excluded from — this is the only unit coverage of that filter.
    expect(is).toHaveBeenCalledWith('removed_at', null)
    expect(order).toHaveBeenCalledWith('created_at', { foreignTable: 'toy_ideas', ascending: false })
    expect(mockAdminFrom).not.toHaveBeenCalled()
  })

  // Tests: a Postgres error surfaces as 500 rather than a swallowed empty list
  // How:   the query's final resolution carries an error
  // Chain: a maker who joined challenges deserves to know the list failed to
  //        load, not be told they have joined nothing
  it('returns 500 on a query error', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    mockFrom.mockReturnValue({ select })

    const res = await makeApp().request('/joined')
    expect(res.status).toBe(500)
  })
})

describe('POST /ideas/:id/messages', () => {
  // Tests: an empty message body is refused before it reaches the database
  // How:   posts a whitespace-only body
  // Chain: blank rows would break the message grouping in ExchangeChat, which
  //        assumes every rendered message has text
  it('rejects a blank message', async () => {
    const res = await makeApp().request('/idea-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: '  ' }),
    })
    expect(res.status).toBe(400)
  })

  // Tests: a non-participant's post is refused as 403
  // How:   the insert returns Postgres' RLS violation code
  // Chain: the thread is private even on a public challenge; a 500 here would
  //        leak that the challenge exists while looking like a fault
  it('returns 403 when the policy refuses the post', async () => {
    mockFrom.mockImplementation(() => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { code: '42501', message: 'rls' } }) }) }),
    }))
    const res = await makeApp().request('/idea-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'hello' }),
    })
    expect(res.status).toBe(403)
  })
})
