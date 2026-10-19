import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, deleteUser, signIn } from '../helpers'

test('WD29 WD30 Thank-you notes lists the notes left for me, and Hide marks one Hidden until Show brings it back', async ({ page }) => {
  const m = await createContributor()
  await acceptTerms(m.id)
  const [wren, noNote] = [await createContributor(), await createContributor()]
  const db = adminClient()
  const { error } = await db.from('profile_thanks').insert([
    { profile_id: m.id, thanker_id: wren.id, note: 'You fixed our switch.', byline: 'Wren', show_note: true },
    { profile_id: m.id, thanker_id: noNote.id, note: null, byline: 'Quiet', show_note: false },
  ])
  if (error) throw new Error(error.message)
  const hiddenAt = async () => (await db.from('profile_thanks').select('hidden_at').eq('profile_id', m.id).eq('thanker_id', wren.id).single()).data!.hidden_at
  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/thanks')
    await expect(page.getByText('You fixed our switch.')).toBeVisible()
    await expect(page.getByText(/^Wren · /)).toBeVisible()
    await expect(page.getByText(/Quiet/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Hide the note from Wren' }).click()
    await expect(page.getByText(/^Wren · .* · Hidden$/)).toBeVisible()
    expect(await hiddenAt()).not.toBeNull()
    await page.reload()
    await expect(page.getByText(/Hidden/)).toBeVisible()

    await page.getByRole('button', { name: 'Show the note from Wren' }).click()
    await expect(page.getByText(/Hidden/)).toHaveCount(0)
    expect(await hiddenAt()).toBeNull()
  } finally {
    await deleteUser(m.id)
    await deleteUser(wren.id)
    await deleteUser(noNote.id)
  }
})
