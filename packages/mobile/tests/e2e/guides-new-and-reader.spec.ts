import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { addSteps } from './guides-fixtures'
import { addPhotoStep, chooseFile } from './family-fixtures'

// A guide with real text in it: the import route answers 422 for a PDF it cannot read.
const READABLE_PDF = '../api/tests/fixtures/pdf-import/Low_Profile_Switch_Assembly_Guide_v1.0.pdf'

test('G07 Add a guide in the Guides corner menu opens the new-guide screen', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.getByRole('button', { name: 'Guides', exact: true }).click()
  await page.getByRole('button', { name: 'Guide actions', exact: true }).click()
  await page.getByRole('button', { name: 'Add a guide', exact: true }).click()
  await expect(page).toHaveURL(/\/guides\/new$/)
  await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toBeVisible()
})

test('N02 Start from a PDF reads the chosen PDF through the import route and shows what it found', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/guides/new')
  await page.getByRole('radio', { name: 'Start from a PDF', exact: true }).click()

  const imported = page.waitForResponse((r) => r.url().includes('/api/tutorials/import-pdf') && r.request().method() === 'POST')
  await chooseFile(page, 'Choose PDF', READABLE_PDF)
  expect((await imported).status()).toBe(200)
  await expect(page.getByTestId('new-guide-pdf-found')).toBeVisible()
  await expect(page.getByText('What we found in Low_Profile_Switch_Assembly_Guide_v1.0.pdf')).toBeVisible()
  // The title field is filled from the PDF; reading is not saving, so no guide exists yet.
  await expect(page.getByPlaceholder('Title')).not.toHaveValue('')
  await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toBeVisible()
})

test('N05 a create refused for missing terms shows the terms gate, and accepting makes the draft', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  await page.getByRole('button', { name: 'Guides', exact: true }).click()
  await page.getByRole('button', { name: 'Guide actions', exact: true }).click()
  await page.getByRole('button', { name: 'Add a guide', exact: true }).click()
  const title = uniqueTitle('E2E Terms Gate')
  await page.getByPlaceholder('Title').fill(title)

  // The account has accepted, so the first create is refused the way an
  // account without the row is (403), once; every later call is real.
  let refused = false
  await page.route('**/api/tutorials', async (route) => {
    if (route.request().method() === 'POST' && !refused) {
      refused = true
      await route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"contributor terms not accepted"}' })
    } else await route.continue()
  })
  await page.getByRole('button', { name: 'Create draft', exact: true }).click()

  await expect(page.getByText('You must accept the contributor terms before contributing.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Accept and continue', exact: true })).toBeDisabled()
  const admin = adminClient()
  await admin.from('user_agreements').delete().eq('user_id', contributor.id).eq('agreement_type', 'contributor_terms')
  await page.getByTestId('new-guide-accept-terms').click()
  const accepted = page.waitForResponse((r) => r.url().includes('/api/agreements') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Accept and continue', exact: true }).click()
  expect((await accepted).ok()).toBe(true)

  await expect(page).toHaveURL(/\/tutorials\/[0-9a-f-]{36}/)
  const { data: terms } = await admin.from('user_agreements').select('agreement_type').eq('user_id', contributor.id).eq('agreement_type', 'contributor_terms')
  expect(terms).toHaveLength(1)
  const { data: made } = await admin.from('tutorials').select('id').eq('title', title)
  expect(made).toHaveLength(1)
})

test('B04 build mode: Leave feedback after the last step posts a note and tells the author', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Build Feedback') })
  await addSteps(id, [{ body: 'Only step.' }])

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Leave feedback', exact: true }).click()

  const sheet = page.getByTestId('feedback-sheet')
  await sheet.getByRole('button', { name: 'Step 1', exact: true }).click()
  const note = `Used a longer screw ${Date.now()}`
  await sheet.getByLabel('Your note').fill(note)
  const posted = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/notes`) && r.request().method() === 'POST')
  await sheet.getByRole('button', { name: 'Post', exact: true }).click()
  expect((await posted).status()).toBe(201)
  await expect(page.getByRole('button', { name: 'See it on the guide', exact: true })).toBeVisible()

  const admin = adminClient()
  const { data: row } = await admin.from('tutorial_notes').select('id, step_position').eq('tutorial_id', id).eq('body', note).single()
  expect(row?.step_position).toBe(1)
  const { data: told } = await admin.from('notifications').select('type').eq('recipient_id', author.id).eq('tutorial_id', id)
  expect(told?.map((n) => n.type)).toContain('tutorial_noted')
})

test('B07 a step photo opens full screen in build mode and closes back to the step', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Step Viewer') })
  await addPhotoStep(id, { title: 'Open the bay', body: 'One screw.', photo_url: 'https://placeholder.invalid/step.jpg' })

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await page.getByLabel('Open the photo for step 1 full screen').click()
  await expect(page.getByText('Pinch to zoom')).toBeVisible()
  await page.getByRole('button', { name: 'Close photo' }).click()
  await expect(page.getByText('Pinch to zoom')).toHaveCount(0)
  await expect(page.getByText('Step 1 of 1')).toBeVisible()
})
