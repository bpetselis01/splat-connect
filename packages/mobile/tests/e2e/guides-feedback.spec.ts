import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, renameProfile, signIn, signInAsNewContributor, uniqueTitle } from './helpers'
import { addNote, addSteps } from './guides-fixtures'

// The Feedback tab (spec 2026-10-07): the list, its filters, the composer
// sheet, the per-note menu from every seat, and a report that names the note.

async function guideWithFeedback() {
  const author = await createContributor()
  await renameProfile(author.id, 'Mei Author')
  const builder = await createContributor()
  await renameProfile(builder.id, 'Dan Builder')
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Feedback Guide') })
  await addSteps(id, [{ title: 'Open the bay', body: 'One screw.' }, { title: 'Close it', body: 'Click.' }])
  const stepNote = `Use a longer screw ${Date.now()}`
  const missingNote = 'You also need a rubber band.'
  const stepNoteId = await addNote(id, builder.id, { step_position: 1, body: stepNote })
  const missingNoteId = await addNote(id, builder.id, { step_position: null, body: missingNote })
  return { author, builder, id, stepNote, missingNote, stepNoteId, missingNoteId }
}

test('a reader sees the list with filters, and a menu with Report only', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithFeedback()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: 'Feedback (2)' }).click()

  await expect(page.getByTestId('feedback-filter-all')).toHaveText('All 2')
  await expect(page.getByTestId('feedback-filter-step-1')).toBeVisible()
  await expect(page.getByTestId('feedback-filter-missing')).toBeVisible()
  await expect(page.getByText(g.stepNote, { exact: true })).toBeVisible()
  await expect(page.getByText('Community notes')).toHaveCount(0)

  await page.getByTestId('feedback-filter-missing').click()
  await expect(page.getByText(g.missingNote)).toBeVisible()
  await expect(page.getByText(g.stepNote, { exact: true })).toHaveCount(0)

  await page.getByTestId(`note-menu-${g.missingNoteId}`).click()
  await expect(page.getByText('Report this note')).toBeVisible()
  await expect(page.getByText('Pin as a fix')).toHaveCount(0)
  await expect(page.getByText('Delete', { exact: true })).toHaveCount(0)
})

test('the author pins from the menu; the fix card and the Overview card follow', async ({ page }) => {
  const g = await guideWithFeedback()
  await signIn(page, g.author.email, g.author.password)
  await page.waitForURL(/\/home$/)
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await page.getByTestId(`note-menu-${g.stepNoteId}`).click()
  const pin = page.waitForResponse((r) => r.url().endsWith(`/notes/${g.stepNoteId}/pin`) && r.request().method() === 'POST')
  await page.getByText('Pin as a fix').click()
  expect((await pin).status()).toBe(200)
  await expect(page.getByText('Fix · approved by Mei')).toBeVisible()
  await expect(page.getByTestId('feedback-filter-fixes')).toHaveText('Fixes 1')
  await page.getByRole('tab', { name: 'Overview' }).click()
  await expect(page.getByText('1 fix from builders')).toBeVisible()
})

test('the composer posts feedback that lands in the list, ringed', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithFeedback()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await page.getByTestId('feedback-composer').click()
  await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeVisible()
  await page.getByText('Step 2', { exact: true }).click()
  const body = `Tinning first helped ${Date.now()}`
  await page.getByLabel('Your note').fill(body)
  const post = page.waitForResponse((r) => r.url().endsWith(`/tutorials/${g.id}/notes`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  const created = await (await post).json()
  await expect(page.getByRole('heading', { name: 'Feedback posted' })).toBeVisible()
  await page.getByRole('button', { name: 'See it on the guide' }).click()
  await expect(page.getByTestId(`note-row-${created.id}`)).toBeInViewport()
  await expect(page.getByText('Your feedback is on the guide')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Feedback (3)' })).toBeVisible()
})

test('Report this note files a report about the note', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithFeedback()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await page.getByTestId(`note-menu-${g.stepNoteId}`).click()
  await page.getByText('Report this note').click()
  await expect(page.getByText(`About Dan Builder's note on`, { exact: false })).toBeVisible()
  await page.getByText('Wrong or missing info').click()
  await page.getByLabel('What happened?').fill('Wrong screw size.')
  const sent = page.waitForResponse((r) => r.url().endsWith('/api/reports') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Send report' }).click()
  const req = (await sent).request().postDataJSON()
  expect(req).toMatchObject({ subject_kind: 'note', subject_id: g.stepNoteId })
  const { data } = await adminClient().from('member_reports').select('subject_kind, subject_id').eq('subject_id', g.stepNoteId).single()
  expect(data).toEqual({ subject_kind: 'note', subject_id: g.stepNoteId })
})
