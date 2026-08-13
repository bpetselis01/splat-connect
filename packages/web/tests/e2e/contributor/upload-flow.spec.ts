/**
 * Creating a tutorial, since the six-step wizard was retired.
 *
 * This file used to walk that wizard end to end and re-check parts, tools,
 * files and STL along the way. Those are now the edit page's steps and are
 * covered once, in edit-tutorial.spec.ts. What is left here is what only
 * creation does: bring the row into existence and hand over to the editor.
 */
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { signIn, createContributor, uniqueTitle, adminClient, acceptTerms } from '../helpers'

const PDF_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.pdf')
const PHOTO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.jpg')

test('creating a tutorial hands straight over to the editor', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  const title = uniqueTitle('E2E Create Handoff')
  await page.goto('/upload')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Difficulty').selectOption('easy')
  await page.getByRole('button', { name: 'Create' }).click()

  // Lands on Files, the first thing the new row still needs.
  await page.waitForURL(/\/tutorials\/[0-9a-f-]{36}\/edit\?step=files$/)

  const { data } = await adminClient()
    .from('tutorials')
    .select('status, difficulty')
    .eq('title', title)
    .single()
  expect(data?.status).toBe('draft')
  expect(data?.difficulty).toBe('easy')
})

test('the later steps are locked until the tutorial exists', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto('/upload')

  // Listed so the journey reads end to end, but not reachable — each one needs
  // an id to save against. Exact names throughout: 'Files' would also match the
  // 'STL Files' pill.
  for (const label of ['Files', 'Parts', 'Tools', 'STL Files', 'Backing', 'Collaborators', 'Review']) {
    await expect(page.getByRole('tab', { name: label, exact: true })).toBeDisabled()
  }
  await expect(page.getByRole('tab', { name: 'Details', exact: true })).toBeEnabled()
})

test('a contributor without accepted terms never reaches the page', async ({ page }) => {
  const contributor = await createContributor()
  // Deliberately no acceptTerms. The page carries no gate of its own because
  // middleware turns this away first, and POST /api/tutorials refuses too.
  await signIn(page, contributor.email, contributor.password)
  // signIn does not await its own navigation, and /dashboard is terms-gated
  // too — so settle there before asking for /upload, or the goto races it.
  await page.waitForURL(/\/onboarding\/contributor-terms/)

  await page.goto('/upload')
  await page.waitForURL(/\/onboarding\/contributor-terms\?next=%2Fupload$/)
})

test('a contributor builds a tutorial from creation through to pending', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  const title = uniqueTitle('E2E Full Journey')
  await page.goto('/upload')
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Difficulty').selectOption('easy')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.waitForURL(/\/tutorials\/[0-9a-f-]{36}\/edit\?step=files$/)

  // Each section saves through a server action that revalidates the page, so
  // the steps are reached by navigation rather than by clicking straight on to
  // the next pill — otherwise the next interaction races the re-render.
  const editUrl = page.url().replace(/\?step=files$/, '')

  const files = page.getByRole('tabpanel')
  await files.locator('input[name="tutorial_pdf"]').setInputFiles(PDF_FIXTURE)
  await files.locator('input[name="toy_photo"]').setInputFiles(PHOTO_FIXTURE)
  await files.getByRole('button', { name: /Save files/i }).click()
  // The toast, not the button: a successful save clears the pending files, so
  // Save files goes straight back to disabled and never reports completion.
  await expect(page.getByRole('status')).toContainText('Files saved', { timeout: 30_000 })

  await page.goto(`${editUrl}?step=parts`)
  const parts = page.getByRole('tabpanel')
  await parts.getByPlaceholder('Name').fill('E2E test part')
  await parts.getByRole('button', { name: 'Add part' }).click()
  await expect(parts.getByRole('button', { name: /E2E test part/ })).toBeVisible()

  await page.goto(`${editUrl}?step=tools`)
  const tools = page.getByRole('tabpanel')
  await tools.getByPlaceholder('Name').fill('E2E test tool')
  await tools.getByRole('button', { name: 'Add tool' }).click()
  await expect(tools.getByRole('button', { name: /E2E test tool/ })).toBeVisible()

  await page.goto(`${editUrl}?step=review`)
  const submit = page.getByRole('button', { name: 'Submit for review' })
  await expect(submit).toBeEnabled({ timeout: 20_000 })
  await submit.click()

  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from('tutorials')
        .select('status')
        .eq('title', title)
        .single()
      return data?.status
    })
    .toBe('pending')

  await page.goto('/dashboard')
  const card = page.getByTestId('tutorial-row').filter({ hasText: title })
  await expect(card).toBeVisible()
  await expect(card.getByText('PENDING', { exact: true })).toBeVisible()
})
