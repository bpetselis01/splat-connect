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
  const title = uniqueTitle('E2E Feedback Guide')
  const id = await createTutorial(author.id, { title })
  await addSteps(id, [{ title: 'Open the bay', body: 'One screw.' }, { title: 'Close it', body: 'Click.' }])
  const stepNote = `Use a longer screw ${Date.now()}`
  const missingNote = 'You also need a rubber band.'
  const stepNoteId = await addNote(id, builder.id, { step_position: 1, body: stepNote })
  const missingNoteId = await addNote(id, builder.id, { step_position: null, body: missingNote })
  return { author, builder, id, title, stepNote, missingNote, stepNoteId, missingNoteId }
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
  const pinned = await adminClient().from('tutorial_notes').select('pinned_at, pinned_by').eq('id', g.stepNoteId).single()
  expect(pinned.data?.pinned_at).not.toBeNull()
  expect(pinned.data?.pinned_by).toBe(g.author.id)
  await page.getByRole('tab', { name: 'Overview' }).click()
  await expect(page.getByText('1 fix from builders')).toBeVisible()

  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await page.getByTestId(`note-menu-${g.stepNoteId}`).click()
  const unpin = page.waitForResponse((r) => r.url().endsWith(`/notes/${g.stepNoteId}/unpin`) && r.request().method() === 'POST')
  await page.getByText('Unpin', { exact: true }).click()
  expect((await unpin).status()).toBe(200)
  await expect(page.getByTestId('feedback-filter-fixes')).toHaveCount(0)
  const after = await adminClient().from('tutorial_notes').select('pinned_at, pinned_by').eq('id', g.stepNoteId).single()
  expect(after.data).toEqual({ pinned_at: null, pinned_by: null })
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
  const res = await post
  expect(res.status()).toBe(201)
  const created = await res.json()
  await expect(page.getByRole('heading', { name: 'Feedback posted' })).toBeVisible()
  await page.getByRole('button', { name: 'See it on the guide' }).click()
  await expect(page.getByTestId(`note-row-${created.id}`)).toBeInViewport()
  await expect(page.getByText('Your feedback is on the guide')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Feedback (3)' })).toBeVisible()
})

test('Report this note files a report about the note', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
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
  const res = await sent
  expect(res.status()).toBe(201)
  expect(res.request().postDataJSON()).toMatchObject({ subject_kind: 'note', subject_id: g.stepNoteId })
  const { data } = await adminClient().from('member_reports').select('subject_kind, subject_id, subject_label, category, body, reporter_id').eq('subject_id', g.stepNoteId).single()
  expect(data).toEqual({ subject_kind: 'note', subject_id: g.stepNoteId, subject_label: `Dan Builder's note on ${g.title}`, category: 'wrong_info', body: 'Wrong screw size.', reporter_id: reader.id })
})

test('your own note offers Delete and no Report; Delete removes the row', async ({ page }) => {
  const g = await guideWithFeedback()
  const reader = await createContributor()
  const mineId = await addNote(g.id, reader.id, { step_position: 2, body: 'Mine, written by me.' })
  await signIn(page, reader.email, reader.password)
  await page.waitForURL(/\/home$/)
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await expect(page.getByText('Mine, written by me.')).toBeVisible()

  await page.getByTestId(`note-menu-${mineId}`).click()
  await expect(page.getByText('Delete', { exact: true })).toBeVisible()
  await expect(page.getByText('Report this note')).toHaveCount(0)
  const del = page.waitForResponse((r) => r.url().includes(`/notes/${mineId}`) && r.request().method() === 'DELETE')
  await page.getByText('Delete', { exact: true }).click()
  expect((await del).status()).toBe(204)
  await expect(page.getByText('Mine, written by me.')).toHaveCount(0)
  const { data } = await adminClient().from('tutorial_notes').select('id').eq('id', mineId)
  expect(data).toEqual([])

  // Another person's note is the mirror image: Report, no Delete (first test covers it for a plain reader).
  await page.getByTestId(`note-menu-${g.stepNoteId}`).click()
  await expect(page.getByText('Report this note')).toBeVisible()
  await expect(page.getByText('Delete', { exact: true })).toHaveCount(0)
})

test('a note posted with a photo shows the thumbnail, and the row carries the photo and caption', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  await renameProfile(reader.id, 'Pia Reader')
  const g = await guideWithFeedback()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await page.getByTestId('feedback-composer').click()
  await page.getByText('Step 2', { exact: true }).click()
  await page.getByLabel('Your note').fill('Here is how mine looks.')

  // Armed before the click: the picker answers a real file chooser, which a dismissed one reads as "cancelled".
  const chooser = page.waitForEvent('filechooser')
  const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/upload/note-photo') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Add a photo', exact: true }).click()
  await (await chooser).setFiles('tests/e2e/fixtures/test.jpg')
  expect((await uploaded).status()).toBeLessThan(300)
  await expect(page.getByRole('button', { name: 'Add a photo', exact: true })).toHaveCount(0)
  await page.getByLabel('Photo caption').fill('Front view')
  const post = page.waitForResponse((r) => r.url().endsWith(`/tutorials/${g.id}/notes`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  const res = await post
  expect(res.status()).toBe(201)
  const created = await res.json()
  await page.getByRole('button', { name: 'See it on the guide' }).click()

  await expect(page.getByLabel("Open Pia Reader's photo full screen")).toBeVisible()
  const { data } = await adminClient().from('tutorial_notes').select('photo_path, photo_caption, author_id').eq('id', created.id).single()
  expect(data!.author_id).toBe(reader.id)
  expect(data!.photo_caption).toBe('Front view')
  expect(data!.photo_path).toMatch(new RegExp(`^${g.id}/notes/[0-9a-f-]{36}\\.(jpg|png|webp|avif|heic|heif)$`))
})
