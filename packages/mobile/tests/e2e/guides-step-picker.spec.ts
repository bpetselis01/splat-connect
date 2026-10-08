// journeys: G23 G25
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, renameProfile, signInAsNewContributor, createTutorial, uniqueTitle } from './helpers'
import { addNote, addSteps } from './guides-fixtures'

/**
 * A 20-step guide: the feedback sheet picks its step from the field and list
 * sheet (search "17", tap the row), the post lands on step 17, and the
 * Feedback tab filters to it through the same picker.
 */
test('feedback on step 17 of a 20-step guide: picked by search, posted, filtered', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const author = await createContributor()
  await renameProfile(author.id, 'Mei Author')
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Twenty Steps Guide') })
  await addSteps(id, Array.from({ length: 20 }, (_, i) => ({ title: i === 16 ? 'Seal with varnish' : `Part number ${i + 1}`, body: 'Do it.' })))
  // Six steps with notes, so the Feedback tab's filter is a field, not chips.
  const others = await createContributor()
  for (const p of [1, 2, 3, 4, 5]) await addNote(id, others.id, { step_position: p, body: `Existing note ${p}` })

  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await page.getByTestId('feedback-composer').click()
  await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeVisible()
  // No wall of pills: one field that says nothing is chosen yet.
  await expect(page.getByText('Step 17', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Which step, Choose a step' }).click()
  await expect(page.getByRole('button', { name: 'Missing step' })).toBeVisible()
  await page.getByLabel('Search steps').fill('17')
  await expect(page.getByRole('button', { name: '17. Seal with varnish' })).toBeVisible()
  await expect(page.getByRole('button', { name: '2. Part number 2' })).toHaveCount(0)
  await page.getByRole('button', { name: '17. Seal with varnish' }).click()
  await expect(page.getByRole('button', { name: 'Which step, 17. Seal with varnish' })).toBeVisible()

  const body = `Brush the varnish on thin ${Date.now()}`
  await page.getByLabel('Your note').fill(body)
  const post = page.waitForResponse((r) => r.url().endsWith(`/tutorials/${id}/notes`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  const res = await post
  expect(res.status()).toBe(201)
  const created = await res.json()
  await expect(page.getByText("It's on the guide's Feedback tab now, under Step 17.")).toBeVisible()
  const row = await adminClient().from('tutorial_notes').select('body, step_position, author_id, tutorial_id').eq('id', created.id).single()
  expect(row.data).toEqual({ body, step_position: 17, author_id: reader.id, tutorial_id: id })

  await page.getByRole('button', { name: 'See it on the guide' }).click()
  await expect(page.getByTestId(`note-row-${created.id}`)).toBeInViewport()
  // Six steps now have notes: the filter is the field.
  await expect(page.getByTestId('feedback-filter-step-17')).toHaveCount(0)
  await page.getByTestId('feedback-filter-step-field').click()
  await page.getByLabel('Search steps').fill('varnish')
  await page.getByRole('button', { name: '17. Seal with varnish' }).click()
  await expect(page.getByText(body)).toBeVisible()
  await expect(page.getByText('Existing note 1')).toHaveCount(0)
})
