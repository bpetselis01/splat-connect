import { test, expect } from '@playwright/test'
import { createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { addSteps } from './guides-fixtures'

// The reader's side of a guide: ticking steps and tools (kept on the device) and
// community notes. A web build keeps device ticks in localStorage, so a reload is
// the same proof a relaunch is on a phone.

test('ticked steps survive a reload, and build mode resumes where they stopped', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Ticks')
  const id = await createTutorial(contributor.id, { title, status: 'approved' })
  await addSteps(id, [{ title: 'Open the bay', body: 'One screw.' }, { title: 'Slide it in', body: 'Copper side down.' }, { title: 'Close it', body: 'Click.' }])

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Step 3 of 3')).toBeVisible()

  await page.goto(`/guides/${id}`)
  await expect(page.getByText('2/3', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Pick up at step 3', exact: true }).click()
  await expect(page.getByText('Step 3 of 3')).toBeVisible()
  await expect(page.getByText('Click.')).toBeVisible()
})

test('finishing every step shows the completion, and the guide then offers Build it again', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile AllDone'), status: 'approved' })
  await addSteps(id, [{ body: 'Only step.' }, { body: 'Second step.' }])

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByText('All 2 steps done')).toBeVisible()
  await page.getByRole('button', { name: 'Back to the guide', exact: true }).click()
  // No reload: the guide page reads the ticks again when it comes back into focus.
  await expect(page.getByRole('button', { name: 'Build it again', exact: true })).toBeVisible()
})

test('a guide with no steps makes Download PDF primary', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile NoSteps'), status: 'approved' })

  await page.goto(`/guides/${id}`)
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start building' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'You’ll need' }).click()
  await expect(page.getByText('E2E part ×2')).toBeVisible()
})

test('a sixty-step guide opens in build mode at step 1 of 60 and moves on', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile ManySteps'), status: 'approved' })
  // position is checked 1-60 by the database, so the most a guide can carry is 60.
  await addSteps(id, Array.from({ length: 60 }, (_, i) => ({ body: `Step body ${i + 1}` })))

  await page.goto(`/guides/${id}`)
  await expect(page.getByLabel('Step 60: Step body 60')).toBeAttached()
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await expect(page.getByText('Step 1 of 60')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Step 2 of 60')).toBeVisible()
  await expect(page.getByText('Step body 2', { exact: true }).last()).toBeVisible()
})

test('ticked tools survive a reload', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile ToolTicks'), status: 'approved' })

  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: 'You’ll need' }).click()
  await expect(page.getByText('0 of 1 already yours')).toBeVisible()
  await page.getByLabel('I already have E2E tool').click()
  await expect(page.getByText('1 of 1 already yours')).toBeVisible()
  await page.reload()
  await page.getByRole('tab', { name: 'You’ll need' }).click()
  await expect(page.getByText('1 of 1 already yours')).toBeVisible()
})

test('a reader posts a note as a missing step and sees it under Discussion', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile Notes'), status: 'approved' })

  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: /^Notes/ }).click()
  const post = page.getByRole('button', { name: 'Post', exact: true })
  await expect(post).toBeDisabled()

  await page.getByRole('button', { name: 'Missing step', exact: true }).click()
  await page.getByLabel('Your note').fill('   ')
  await expect(post).toBeDisabled()

  const note = `Test the switch first 🧸 "twice" <b>& again</b>`
  await page.getByLabel('Your note').fill(note)
  const posted = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/notes`) && r.request().method() === 'POST')
  await post.click()
  expect((await posted).status()).toBe(201)

  await expect(page.getByText(note)).toBeVisible()
  await expect(page.getByText('Community notes 1')).toBeVisible()
  // The form emptied.
  await expect(page.getByLabel('Your note')).toHaveValue('')
})

test('a note that fails to post keeps its words and says so', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile NoteFails'), status: 'approved' })

  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: /^Notes/ }).click()
  await page.route(`**/api/tutorials/${id}/notes`, (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }) : route.continue()))
  await page.getByRole('button', { name: 'Missing step', exact: true }).click()
  await page.getByLabel('Your note').fill('Keep these words')
  await page.getByRole('button', { name: 'Post', exact: true }).click()

  await expect(page.getByText('Could not post that. Please try again.')).toBeVisible()
  await expect(page.getByLabel('Your note')).toHaveValue('Keep these words')
})

test('the author deletes their own note', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile NoteDelete'), status: 'approved' })

  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: /^Notes/ }).click()
  await page.getByRole('button', { name: 'Missing step', exact: true }).click()
  await page.getByLabel('Your note').fill('Delete me later')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.getByText('Delete me later')).toBeVisible()

  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Delete me later')).toHaveCount(0)
  await expect(page.getByText('Community notes 0')).toBeVisible()
})
