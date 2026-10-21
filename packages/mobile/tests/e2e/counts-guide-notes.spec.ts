import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, renameProfile, signIn, uniqueTitle } from './helpers'
import { addNote, addSteps } from './guides-fixtures'

/**
 * The reader's note filter chips carry counts (All N, Fixes N) and appear per
 * step. Posting, pinning and deleting a note each move them with no reload.
 */

test('G25 posting, pinning and deleting a note move the filter chips without a reload', async ({ page }) => {
  const author = await createContributor()
  await renameProfile(author.id, 'Mei Author')
  const builder = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Chip Counts Guide') })
  await addSteps(id, [{ title: 'Open the bay', body: 'One screw.' }, { title: 'Close it', body: 'Click.' }])
  await addNote(id, builder.id, { step_position: 1, body: `Use a longer screw ${Date.now()}` })
  await addNote(id, builder.id, { step_position: null, body: 'You also need a rubber band.' })

  await signIn(page, author.email, author.password)
  await page.waitForURL(/\/home$/)
  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await expect(page.getByTestId('feedback-filter-all')).toHaveText('All 2')
  await expect(page.getByTestId('feedback-filter-step-2')).toHaveCount(0)
  await expect(page.getByTestId('feedback-filter-fixes')).toHaveCount(0)

  // Post a note on step 2: All goes to 3 and a Step 2 chip appears.
  await page.getByTestId('feedback-composer').click()
  await page.getByText('Step 2', { exact: true }).click()
  const body = `Tinning first helped ${Date.now()}`
  await page.getByLabel('Your note').fill(body)
  const post = page.waitForResponse((r) => r.url().endsWith(`/tutorials/${id}/notes`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  const created = await (await post).json()
  await page.getByRole('button', { name: 'See it on the guide' }).click()
  await expect(page.getByTestId('feedback-filter-all')).toHaveText('All 3')
  await expect(page.getByTestId('feedback-filter-step-2')).toBeVisible()
  const row = await adminClient().from('tutorial_notes').select('body, step_position, author_id').eq('id', created.id).single()
  expect(row.data).toEqual({ body, step_position: 2, author_id: author.id })

  // Pin it: a Fixes 1 chip appears.
  await page.getByTestId(`note-menu-${created.id}`).click()
  await page.getByText('Pin as a fix').click()
  await expect(page.getByTestId('feedback-filter-fixes')).toHaveText('Fixes 1')
  const pinned = await adminClient().from('tutorial_notes').select('pinned_at').eq('id', created.id).single()
  expect(pinned.data?.pinned_at).not.toBeNull()

  // Delete it: All drops back to 2 and both extra chips go.
  await page.getByTestId(`note-menu-${created.id}`).click()
  await page.getByText('Delete', { exact: true }).click()
  await expect(page.getByTestId('feedback-filter-all')).toHaveText('All 2')
  await expect(page.getByTestId('feedback-filter-fixes')).toHaveCount(0)
  await expect(page.getByTestId('feedback-filter-step-2')).toHaveCount(0)
  await expect.poll(async () => (await adminClient().from('tutorial_notes').select('id').eq('id', created.id)).data).toEqual([])
})
