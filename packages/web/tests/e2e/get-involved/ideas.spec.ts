import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, deleteUser, signIn, uniqueTitle } from '../helpers'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

test('WI11 WI12 a member adds a photo and submits an idea, and My challenges shows it waiting for review', async ({ page }) => {
  const member = await createContributor()
  await acceptTerms(member.id)
  const title = uniqueTitle('Bubble machine')
  try {
    await signIn(page, member.email, member.password)
    await page.goto('/get-involved/submit-an-idea')
    await page.getByLabel('Title', { exact: true }).fill(title)
    await page.getByLabel('Summary', { exact: true }).fill('One switch starts the bubbles.')
    await page.getByLabel('Drop a photo of the toy').setInputFiles({ name: 'toy.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('img', { name: 'Your photo' })).toBeVisible()
    await page.getByRole('button', { name: 'Submit for review' }).click()

    await expect(page).toHaveURL(/\/dashboard\/challenges$/)
    const card = page.locator('.card', { hasText: title })
    await expect(card).toBeVisible()
    await expect(card.getByText('Waiting', { exact: true })).toBeVisible()
    await expect(card.getByText('Nothing is public until one is approved.')).toBeVisible()
    const { data } = await adminClient().from('toy_ideas').select('status, photo_path').eq('title', title).single()
    expect(data?.status).toBe('pending')
    expect(data?.photo_path).toMatch(new RegExp(`^ideas/${member.id}/`))
  } finally {
    await adminClient().from('toy_ideas').delete().eq('title', title)
    await deleteUser(member.id)
  }
})
