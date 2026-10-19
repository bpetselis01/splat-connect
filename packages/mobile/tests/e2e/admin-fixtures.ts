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
