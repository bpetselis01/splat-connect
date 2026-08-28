/**
 * Who to tell when work is handed over for a decision.
 *
 * Two moments, both previously silent:
 * - an author asks an organisation to back a project  -> that org's leaders
 * - an author submits a project for review            -> the leaders of every
 *   organisation that ACCEPTED the backing, or every admin if none did
 *
 * Lives in its own module rather than in either route because both routes need
 * it and they sit in different files (routes/tutorial-orgs.ts and
 * routes/tutorials.ts); exporting it from one of them would make the other
 * import a route.
 *
 * Every write here uses the admin client. That is not a shortcut: 013 gives
 * notifications no INSERT policy for ordinary users on purpose, because every
 * notification is written on behalf of someone other than the caller.
 *
 * Failures are logged, never thrown. By the time either of these is called the
 * thing being announced has already happened and been committed — failing the
 * request would tell the author their submission did not go through when it
 * did. Same choice admin.ts's idea-status handler makes, and the opposite of
 * its graduate handler, where the notification is part of the act.
 *
 * Related files:
 * - supabase/migrations/046_review_queue_notifications.sql: the two type values
 * - packages/web/components/notifications-list.tsx: the copy and the link
 */
import { createAdminClient } from './supabase/client.js'

type Admin = ReturnType<typeof createAdminClient>

/** The display name to stamp on the row. Denormalised at insert time, as 013's
    actor_name comment explains. Falls back rather than failing the notify. */
async function actorName(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin.from('profiles').select('name').eq('id', userId).maybeSingle()
  return (data?.name as string | undefined) ?? 'A contributor'
}

/**
 * Leaders of these organisations, minus `exclude`.
 *
 * The exclusion is not cosmetic: an author who also leads the backing
 * organisation is a real case (a therapist writing up their own service's
 * work), and "you asked yourself to review this" is noise that makes the badge
 * less trustworthy. Note this is the only filter — a leader of two backing
 * organisations is deduplicated too, since a person should get one
 * notification about one project, not one per hat they wear.
 */
async function leaderIds(admin: Admin, orgIds: string[], exclude: string): Promise<string[]> {
  if (!orgIds.length) return []
  const { data, error } = await admin.from('org_leaders').select('user_id').in('org_id', orgIds)
  if (error) {
    console.error('[review-notifications] org_leaders lookup failed:', error.message)
    return []
  }
  return [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))].filter(
    (id) => id !== exclude
  )
}

/** Every admin. profiles.role is the one capability that column still carries —
    see packages/web/lib/capabilities.ts. */
async function adminIds(admin: Admin, exclude: string): Promise<string[]> {
  const { data, error } = await admin.from('profiles').select('id').eq('role', 'admin')
  if (error) {
    console.error('[review-notifications] admin lookup failed:', error.message)
    return []
  }
  return (data ?? []).map((r: { id: string }) => r.id).filter((id: string) => id !== exclude)
}

async function insert(
  admin: Admin,
  recipients: string[],
  row: { type: 'backing_requested' | 'tutorial_submitted'; tutorial_id: string; tutorial_title: string; actor_name: string }
) {
  if (!recipients.length) return
  const { error } = await admin
    .from('notifications')
    .insert(recipients.map((recipient_id) => ({ recipient_id, ...row })))
  if (error) console.error(`[review-notifications] ${row.type} insert failed:`, error.message)
}

/**
 * An author asked one organisation to back a project. Tell its leaders.
 *
 * Called after the tutorial_orgs insert succeeds — never on the 23505
 * duplicate path, where nothing new happened and re-notifying would let an
 * author spam a leader by pressing the button again.
 */
export async function notifyBackingRequested(opts: {
  tutorialId: string
  orgId: string
  actorId: string
}): Promise<void> {
  const admin = createAdminClient()
  const { data: tutorial } = await admin
    .from('tutorials')
    .select('title')
    .eq('id', opts.tutorialId)
    .maybeSingle()
  const recipients = await leaderIds(admin, [opts.orgId], opts.actorId)
  await insert(admin, recipients, {
    type: 'backing_requested',
    tutorial_id: opts.tutorialId,
    tutorial_title: (tutorial?.title as string | undefined) ?? '',
    actor_name: await actorName(admin, opts.actorId),
  })
}

/**
 * An author moved a project from draft to pending. Tell whoever has to look at
 * it: the leaders of every organisation that accepted the backing, or — when
 * no organisation is backing it, so no leader will ever see it — every admin.
 *
 * Admins are deliberately NOT told about backed submissions. They keep
 * /admin/review as the catch-all list, and a notification per submission would
 * be the same information twice for the one role that already has a queue.
 */
export async function notifyTutorialSubmitted(opts: {
  tutorialId: string
  tutorialTitle: string
  actorId: string
}): Promise<void> {
  const admin = createAdminClient()
  const { data: backing, error } = await admin
    .from('tutorial_orgs')
    .select('org_id')
    .eq('tutorial_id', opts.tutorialId)
    .eq('status', 'accepted')
  if (error) {
    console.error('[review-notifications] backing lookup failed:', error.message)
    return
  }
  const orgIds = (backing ?? []).map((r: { org_id: string }) => r.org_id)
  // Note this branches on the ORGANISATIONS, not on the recipients: a project
  // backed by an organisation whose only leader is the author themselves
  // notifies nobody rather than falling through to the admins. That is correct
  // — the organisation did take it on, and the author already knows.
  const recipients = orgIds.length
    ? await leaderIds(admin, orgIds, opts.actorId)
    : await adminIds(admin, opts.actorId)
  await insert(admin, recipients, {
    type: 'tutorial_submitted',
    tutorial_id: opts.tutorialId,
    tutorial_title: opts.tutorialTitle,
    actor_name: await actorName(admin, opts.actorId),
  })
}
