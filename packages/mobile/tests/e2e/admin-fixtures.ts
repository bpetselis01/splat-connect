import { type Page, expect } from '@playwright/test'
import { adminClient, createAdmin, createContributor, signIn, uniqueTitle } from './helpers'

/** An admin signed in through the ordinary form; the Me tab reads profile.role afterwards. */
export async function signInAdmin(page: Page) {
  const admin = await createAdmin()
  await signIn(page, admin.email, admin.password)
  await expect(page).toHaveURL(/\/home$/)
  return admin
}

/** The number on one /admin card, read from its accessible name ("Label, N"). */
export async function cardCount(page: Page, label: string) {
  await page.goto('/admin')
  const card = page.getByRole('button', { name: new RegExp(`^${label}, \\d+$`) })
  await expect(card).toBeVisible()
  return Number((await card.getAttribute('aria-label'))!.split(', ').pop())
}

const head = { count: 'exact', head: true } as const

/** What GET /api/admin/counts counts for each card, read straight from the table. */
const LIVE: Record<string, (adminId: string) => PromiseLike<{ count: number | null }>> = {
  'Reports from members': () => adminClient().from('member_reports').select('id', head).neq('status', 'resolved'),
  'Ideas awaiting review': () => adminClient().from('toy_ideas').select('id', head).eq('status', 'pending'),
  Accounts: () => adminClient().from('profiles').select('id', head).neq('role', 'admin'),
  Organisations: () => adminClient().from('organizations').select('id', head),
  'Spot-check': (adminId) =>
    adminClient().from('tutorials').select('id', head).eq('status', 'approved').not('reviewed_by', 'is', null).neq('reviewed_by', adminId),
}

/**
 * Polls until the card shows what its table holds. Other specs write the same
 * tables at the same time, so the card is compared with a table read, never
 * with a number taken before the action. `adminId` is needed for Spot-check only.
 */
export async function expectCard(page: Page, label: string, adminId = '') {
  await expect
    .poll(
      async () => {
        const live = Math.min((await LIVE[label](adminId)).count ?? 0, label === 'Spot-check' ? 10 : Infinity)
        return (await cardCount(page, label)) - live
      },
      { timeout: 30_000 }
    )
    .toBe(0)
}

/** A toy idea in the given state, written by a fresh contributor with a name only this spec knows. */
export async function seedIdea(status: 'pending' | 'challenge' | 'graduated', over: Partial<{ title: string; authorId: string }> = {}) {
  const authorId = over.authorId ?? (await createContributor()).id
  const title = over.title ?? uniqueTitle('E2E Admin Idea')
  const { data, error } = await adminClient()
    .from('toy_ideas')
    .insert({
      author_id: authorId, title, summary: 'Seeded for the admin queue.', description: 'D',
      intended_use: 'A bubble machine.', primary_user: 'A child.', status,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedIdea failed: ${error?.message}`)
  return { id: data.id as string, title, authorId }
}

/** A member report in the given state, filed by `reporterId` about a subject only this spec knows. */
export async function seedMemberReport(
  reporterId: string,
  over: Partial<{ status: 'new' | 'looking' | 'resolved'; note: string; label: string }> = {}
) {
  const label = over.label ?? uniqueTitle('E2E Reported Toy')
  const { data, error } = await adminClient()
    .from('member_reports')
    .insert({
      reporter_id: reporterId, subject_kind: 'toy', subject_label: label, category: 'other', body: 'The skin is loose.',
      status: over.status ?? 'new', note_to_reporter: over.note ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedMemberReport failed: ${error?.message}`)
  return { id: data.id as string, label }
}

/** A report against `targetId` inside a live challenge, with the target already a participant. */
export async function seedIdeaReport(over: Partial<{ resolved: boolean; removed: boolean }> = {}) {
  const author = await createContributor()
  const target = await createContributor()
  const reporter = await createContributor()
  const targetName = uniqueTitle('Reported Maker')
  await adminClient().from('profiles').update({ name: targetName }).eq('id', target.id)
  const idea = await seedIdea('challenge', { authorId: author.id })
  await adminClient().from('toy_idea_participants').insert({
    idea_id: idea.id, profile_id: target.id,
    ...(over.removed ? { removed_at: new Date().toISOString(), removed_by: author.id } : {}),
  })
  const { data, error } = await adminClient()
    .from('toy_idea_reports')
    .insert({
      idea_id: idea.id, reported_profile_id: target.id, reported_by: reporter.id, reason: 'Rude in the thread',
      ...(over.resolved ? { resolved_at: new Date().toISOString(), resolved_by: author.id, resolution_note: 'Handled' } : {}),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedIdeaReport failed: ${error?.message}`)
  return { id: data.id as string, ideaId: idea.id, ideaTitle: idea.title, targetId: target.id, targetName, rowTitle: `${targetName} in ${idea.title}` }
}
