import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createNotification, deleteUser, signIn, uniqueTitle } from '../helpers'

async function member() {
  const m = await createContributor()
  await acceptTerms(m.id)
  return m
}

async function seedIdea(authorId: string, title: string, status = 'pending') {
  const { data, error } = await adminClient()
    .from('toy_ideas')
    .insert({
      author_id: authorId, title, status,
      summary: 'A remote a shaky hand can still use.', description: 'Full description',
      intended_use: 'Living room', primary_user: 'A child with limited grip',
    })
    .select('id')
    .single()
  if (error) throw new Error(`seedIdea failed: ${error.message}`)
  return data.id
}

test('WD22 opening My challenges clears the challenges notifications and the header badge', async ({ page }) => {
  const m = await member()
  const ideaId = await seedIdea(m.id, uniqueTitle('Approved idea'), 'challenge')
  const noteId = await createNotification(m.id, { type: 'idea_approved', idea_id: ideaId })
  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard')
    await expect(page.getByRole('banner').locator('.nav-account__badge')).toHaveText('1')

    await page.goto('/dashboard/challenges')
    await expect(page.getByRole('heading', { name: 'Design challenges' })).toBeVisible()
    await expect
      .poll(async () => (await adminClient().from('notifications').select('read_at').eq('id', noteId).single()).data!.read_at)
      .not.toBeNull()

    await page.goto('/dashboard')
    await expect(page.getByRole('banner').locator('.nav-account__badge')).toHaveCount(0)
  } finally {
    await deleteUser(m.id)
  }
})

test('WD24 Withdraw the idea removes my pending idea from the list and from the database', async ({ page }) => {
  const m = await member()
  const title = uniqueTitle('Idea to withdraw')
  const keepTitle = uniqueTitle('Idea to keep')
  const id = await seedIdea(m.id, title)
  await seedIdea(m.id, keepTitle)
  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/challenges')
    const card = page.getByRole('listitem').filter({ hasText: title })
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Withdraw the idea' }).click()

    await expect(page.getByText('Withdrawn — nothing was published')).toBeVisible()
    await expect(page.getByText(title)).toHaveCount(0)
    await expect(page.getByText(keepTitle)).toBeVisible()
    const { data } = await adminClient().from('toy_ideas').select('id').eq('id', id)
    expect(data).toEqual([])
  } finally {
    await deleteUser(m.id)
  }
})

test('WD25 My challenges links to the saved challenges, the public challenges and the idea form', async ({ page }) => {
  const m = await member()
  await seedIdea(m.id, uniqueTitle('Any idea'))
  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/challenges')
    const main = page.getByRole('main')

    await main.getByRole('link', { name: 'Saved challenges' }).click()
    await expect(page).toHaveURL('/dashboard/saved/challenges')

    await page.goto('/dashboard/challenges')
    await main.getByRole('link', { name: 'Browse challenges' }).click()
    await expect(page).toHaveURL('/get-involved/design-challenges')

    await page.goto('/dashboard/challenges')
    await main.getByRole('link', { name: 'Submit an idea' }).click()
    await expect(page).toHaveURL('/get-involved/submit-an-idea')
  } finally {
    await deleteUser(m.id)
  }
})
