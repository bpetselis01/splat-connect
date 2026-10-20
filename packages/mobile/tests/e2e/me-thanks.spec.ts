import { test, expect } from '@playwright/test'
import { adminClient, createContributor, signIn } from './helpers'

async function seedNote(makerId: string, thankerId: string, note: string, byline: string) {
  const { error } = await adminClient()
    .from('profile_thanks')
    .insert({ profile_id: makerId, thanker_id: thankerId, note, byline, show_note: false })
  if (error) throw new Error(`seedNote failed: ${error.message}`)
}
const hiddenAt = async (makerId: string, thankerId: string) =>
  (await adminClient().from('profile_thanks').select('hidden_at').eq('profile_id', makerId).eq('thanker_id', thankerId).single()).data!.hidden_at

test('Q22 Thank-you notes lists the notes people left, to the person thanked and nobody else', async ({ page, browser, baseURL }) => {
  const maker = await createContributor()
  const family = await createContributor()
  await seedNote(maker.id, family.id, 'You fixed our switch.', 'Wren')
  await signIn(page, maker.email, maker.password)
  await expect(page).toHaveURL(/\/home$/)

  await page.goto('/thanks')
  await expect(page.getByText('“You fixed our switch.”')).toBeVisible()
  await expect(page.getByText(/^Wren · /)).toBeVisible()

  const context = await browser.newContext({ baseURL })
  const familyPage = await context.newPage()
  await signIn(familyPage, family.email, family.password)
  await expect(familyPage).toHaveURL(/\/home$/)
  await familyPage.goto('/thanks')
  await expect(familyPage.getByText('No notes yet')).toBeVisible()
  await expect(familyPage.getByText('You fixed our switch.')).toHaveCount(0)
})

test('Q23 Hide tags the note Hidden and Show clears it, and the row keeps its state', async ({ page }) => {
  const maker = await createContributor()
  const family = await createContributor()
  await seedNote(maker.id, family.id, 'Quiet and sturdy.', 'Idris')
  await signIn(page, maker.email, maker.password)
  await expect(page).toHaveURL(/\/home$/)

  await page.goto('/thanks')
  await expect(page.getByText(/^Idris · /)).not.toContainText('Hidden')
  await page.getByRole('button', { name: 'Hide the note from Idris' }).click()
  await expect(page.getByText(/^Idris · .* · Hidden$/)).toBeVisible()
  await expect.poll(() => hiddenAt(maker.id, family.id)).not.toBeNull()

  await page.reload()
  await expect(page.getByText(/^Idris · .* · Hidden$/)).toBeVisible()
  await page.getByRole('button', { name: 'Show the note from Idris' }).click()
  await expect(page.getByRole('button', { name: 'Hide the note from Idris' })).toBeVisible()
  await expect(page.getByText(/Hidden$/)).toHaveCount(0)
  await expect.poll(() => hiddenAt(maker.id, family.id)).toBeNull()
})
