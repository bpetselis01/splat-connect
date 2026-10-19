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

/** Re-reads a card until it shows `n`; the count comes from one GET on focus, so a goto is a fresh read. */
export async function expectCard(page: Page, label: string, n: number) {
  await expect(async () => {
    expect(await cardCount(page, label)).toBe(n)
  }).toPass()
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
