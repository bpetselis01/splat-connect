import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, renameProfile, signIn, signInAsNewContributor, uniqueTitle } from './helpers'
import { addNote, addSteps } from './guides-fixtures'

// Community notes (093) from every seat: the reader who only reads, the
// author who pins, the reader who reports, and a note that carries a photo.
// guides-reader-journeys.spec.ts covers posting and deleting your own note.

const PHOTO_FIXTURE = 'tests/e2e/fixtures/test.jpg'

async function guideWithNotes() {
  const author = await createContributor()
  await renameProfile(author.id, 'Mei Author')
  const builder = await createContributor()
  await renameProfile(builder.id, 'Dan Builder')
  const title = uniqueTitle('E2E Notes Guide')
  const id = await createTutorial(author.id, { title })
  await addSteps(id, [{ title: 'Open the bay', body: 'One screw.' }, { title: 'Close it', body: 'Click.' }])
  const stepNote = `Use a longer screw 🧸 "here" <b>& there</b> ${Date.now()}`
  const missingNote = 'You also need a rubber band.'
  const stepNoteId = await addNote(id, builder.id, { step_position: 1, body: stepNote })
  const missingNoteId = await addNote(id, builder.id, { step_position: null, body: missingNote })
  return { author, builder, title, id, stepNote, missingNote, stepNoteId, missingNoteId }
}

test('a reader who did not write the guide reads its notes, with no Pin and no Delete', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithNotes()

  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Notes/ }).click()

  await expect(page.getByText('Community notes 2')).toBeVisible()
  await expect(page.getByText('Discussion · 2')).toBeVisible()
  await expect(page.getByText('Revisions')).toHaveCount(0)
  await expect(page.getByText(g.stepNote, { exact: true })).toBeVisible()
  await expect(page.getByText(/^Step 1 · Dan Builder · /)).toBeVisible()
  await expect(page.getByText(g.missingNote, { exact: true })).toBeVisible()
  await expect(page.getByText(/^Missing step · Dan Builder · /)).toBeVisible()
  await expect(page.getByText('Mei Author can pin it as a revision', { exact: false })).toBeVisible()

  await expect(page.getByRole('button', { name: 'Pin as revision' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
})

test('the author pins a note and unpins it, and the guide page shows the fix while it is pinned', async ({ page }) => {
  const g = await guideWithNotes()
  await signIn(page, g.author.email, g.author.password)
  await page.waitForURL(/\/home$/)

  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Notes/ }).click()
  await expect(page.getByText(g.stepNote, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pin as revision' })).toHaveCount(2)

  const pinNote = page.waitForResponse((r) => r.url().endsWith(`/notes/${g.stepNoteId}/pin`) && r.request().method() === 'POST')
  // The step note is the first in the list: the oldest.
  await page.getByRole('button', { name: 'Pin as revision' }).first().click()
  expect((await pinNote).status()).toBe(200)
  await expect(page.getByText('Pinned as a revision — shows above Steps')).toBeVisible()
  await expect(page.getByText('Revisions · 1 pinned')).toBeVisible()
  await expect(page.getByText('Discussion · 1')).toBeVisible()
  await expect(page.getByText('Pinned by Mei Author')).toBeVisible()
  const pinned = await adminClient().from('tutorial_notes').select('pinned_at, pinned_by').eq('id', g.stepNoteId).single()
  expect(pinned.data?.pinned_at).not.toBeNull()
  expect(pinned.data?.pinned_by).toBe(g.author.id)

  // On the overview it becomes the fix from builders.
  await page.getByRole('tab', { name: 'Overview' }).click()
  await expect(page.getByText('1 fix from builders')).toBeVisible()
  await expect(page.getByText('Read the fix')).toBeVisible()

  await page.getByRole('tab', { name: /^Notes/ }).click()
  const unpinNote = page.waitForResponse((r) => r.url().endsWith(`/notes/${g.stepNoteId}/unpin`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Unpin', exact: true }).click()
  expect((await unpinNote).status()).toBe(200)
  await expect(page.getByText('Unpinned', { exact: true })).toBeVisible()
  await expect(page.getByText('Revisions', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Discussion · 2')).toBeVisible()
  const after = await adminClient().from('tutorial_notes').select('pinned_at, pinned_by').eq('id', g.stepNoteId).single()
  expect(after.data).toEqual({ pinned_at: null, pinned_by: null })
})

test('a reader reports someone else\'s note, and the report names the guide it is on', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const g = await guideWithNotes()
  await adminClient().from('tutorial_notes').delete().eq('id', g.missingNoteId)

  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Notes/ }).click()
  await expect(page.getByText(g.stepNote, { exact: true })).toBeVisible()
  // The hero has its own Report a problem (for the guide); the note's is the last.
  await expect(page.getByRole('button', { name: 'Report a problem' })).toHaveCount(2)
  await page.getByRole('button', { name: 'Report a problem' }).last().click()

  await expect(page.getByText(`About A note on ${g.title}`)).toBeVisible()
  await page.getByRole('radio', { name: 'Something else', exact: true }).click()
  await page.getByLabel('What happened?').fill('This note is rude.')
  const posted = page.waitForResponse((r) => r.url().endsWith('/api/reports') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Send report', exact: true }).click()
  expect((await posted).status()).toBe(201)
  await expect(page.getByText('Sent to SPLAT. You will hear back within two days.')).toBeVisible()

  const { data } = await adminClient().from('member_reports').select('subject_kind, subject_id, subject_label, category, body').eq('reporter_id', reader.id)
  expect(data).toEqual([{ subject_kind: 'guide', subject_id: g.id, subject_label: `A note on ${g.title}`, category: 'other', body: 'This note is rude.' }])
})

test('your own note offers Delete and no Report', async ({ page }) => {
  const g = await guideWithNotes()
  const reader = await createContributor()
  await addNote(g.id, reader.id, { step_position: 2, body: 'Mine, written by me.' })
  await signIn(page, reader.email, reader.password)
  await page.waitForURL(/\/home$/)

  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Notes/ }).click()
  await expect(page.getByText('Mine, written by me.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(1)
  // The hero's, plus one for each of the two other people's notes; not for the reader's own.
  await expect(page.getByRole('button', { name: 'Report a problem' })).toHaveCount(3)
})

test('a note posted with a photo shows the photo and its caption, and the upload lands under the guide', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Note Photo Guide') })

  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: /^Notes/ }).click()
  await page.getByRole('button', { name: 'Missing step', exact: true }).click()
  await page.getByLabel('Your note').fill('Here is how mine looks.')

  // Armed before the click: the picker answers a real file chooser, which a dismissed one reads as "cancelled".
  const chooser = page.waitForEvent('filechooser')
  const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/upload/note-photo') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Add a photo', exact: true }).click()
  await (await chooser).setFiles(PHOTO_FIXTURE)
  expect((await uploaded).status()).toBeLessThan(300)

  await expect(page.getByRole('button', { name: 'Add a photo', exact: true })).toHaveCount(0)
  await page.getByLabel('Photo caption').fill('Front view')
  const posted = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/notes`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  expect((await posted).status()).toBe(201)

  await expect(page.getByText('Here is how mine looks.')).toBeVisible()
  await expect(page.getByLabel('Front view').first()).toBeVisible()
  const { data } = await adminClient().from('tutorial_notes').select('photo_path, photo_caption, author_id').eq('tutorial_id', id)
  expect(data).toHaveLength(1)
  expect(data![0]!.author_id).toBe(reader.id)
  expect(data![0]!.photo_caption).toBe('Front view')
  expect(data![0]!.photo_path).toMatch(new RegExp(`^${id}/notes/[0-9a-f-]{36}\\.(jpg|png|webp|avif|heic|heif)$`))
})
