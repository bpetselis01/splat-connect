import { test, expect, type Page } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, uniqueTitle } from './helpers'

// Paths, not inline buffers: a FilePayload's `buffer` is typed `Buffer`, and
// this package has no @types/node (adding it would also retype every RN timer
// as NodeJS.Timeout). Relative to the cwd, which is this package for both
// `pnpm test:e2e` and CI's `pnpm --filter @splat-connect/mobile test:e2e`.
// Same two throwaway files web's upload specs use.
const PDF_FIXTURE = 'tests/e2e/fixtures/test.pdf'
const PHOTO_FIXTURE = 'tests/e2e/fixtures/test.jpg'

/**
 * Hand a file to whichever picker the tapped button opened.
 *
 * Both expo-document-picker and expo-image-picker take the same web path: they
 * append a hidden `<input type="file">` to document.body and dispatch a click
 * at it, which Chromium answers with a real file chooser. Playwright dismisses
 * an unhandled chooser, and both pickers read that dismissal as "cancelled" and
 * resolve with no asset — so setting files on the input afterwards is too late,
 * nothing is listening any more. Intercepting the chooser is the only handoff
 * the picker actually sees, and the wait has to be armed before the click.
 */
async function chooseFile(page: Page, button: string, file: string) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: button, exact: true }).click()
  await (await chooser).setFiles(file)
}

test('a new account writes a guide end to end and submits it for review', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())

  // --- Add a guide -------------------------------------------------------
  const title = uniqueTitle('E2E Mobile Authored')
  await page.getByRole('button', { name: '+ Add a guide', exact: true }).click()
  await expect(page).toHaveURL(/\/guides\/new$/)

  await page.getByPlaceholder('Title').fill(title)
  await page.getByRole('button', { name: 'Create draft', exact: true }).click()

  // The signup form already accepted the contributor terms, so POST
  // /api/tutorials is not gated and the draft opens straight away.
  await expect(page).toHaveURL(/\/tutorials\/[0-9a-f-]{36}$/)
  const id = page.url().split('/').pop() as string

  // --- Details -----------------------------------------------------------
  await expect(page.getByRole('tab', { name: 'Details', exact: true })).toBeVisible()
  await page.getByPlaceholder('Description').fill('Written by a Playwright E2E test.')
  // Waited out rather than fired and forgotten: every PATCH carries the
  // updated_at the screen last saw, and a stale one comes back 409 — so each
  // write has to have been merged back into state before the next one starts.
  const detailsSaved = page.waitForResponse(
    (r) => r.url().includes(`/api/tutorials/${id}`) && r.request().method() === 'PATCH'
  )
  await page.getByRole('button', { name: 'Save details', exact: true }).click()
  expect((await detailsSaved).status()).toBe(200)

  // --- Parts -------------------------------------------------------------
  await page.getByRole('tab', { name: 'Parts', exact: true }).click()
  await page.getByRole('button', { name: '+ Add a part', exact: true }).click()
  await page.getByLabel('Part 1 name').fill('Micro switch')
  await page.getByRole('button', { name: 'Increase quantity for part 1' }).click()
  await page.getByRole('button', { name: 'Save parts', exact: true }).click()

  // --- Tools -------------------------------------------------------------
  await page.getByRole('tab', { name: 'Tools', exact: true }).click()
  await page.getByRole('button', { name: '+ Add a tool', exact: true }).click()
  await page.getByLabel('Tool 1 name').fill('Soldering iron')
  await page.getByRole('button', { name: 'Save tools', exact: true }).click()

  // --- Review, mid-draft: the files gap holds Submit shut -----------------
  await page.getByRole('tab', { name: 'Review', exact: true }).click()
  const gaps = page.getByText(/^Still needed:/)
  await expect(gaps).toContainText('The guide PDF')
  await expect(gaps).toContainText('A photo')
  // Saved, so no longer listed — this is what proves the two saves above landed.
  await expect(gaps).not.toContainText('A part')
  await expect(gaps).not.toContainText('A tool')
  await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toBeDisabled()

  // --- Files -------------------------------------------------------------
  await page.getByRole('tab', { name: 'Files', exact: true }).click()
  await expect(page.getByText('No PDF yet')).toBeVisible()

  await chooseFile(page, 'Choose PDF from Files', PDF_FIXTURE)
  // /api/upload/pdf always writes <id>/tutorial.pdf, and the row's label is the
  // stored path's last segment. Its arrival means the PATCH committed too, so
  // the next save is working from a fresh updated_at.
  await expect(page.getByText('tutorial.pdf')).toBeVisible()

  await chooseFile(page, 'Choose from library', PHOTO_FIXTURE)

  // --- Review, complete: Submit opens ------------------------------------
  await page.getByRole('tab', { name: 'Review', exact: true }).click()
  const submit = page.getByRole('button', { name: 'Submit for review', exact: true })
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(page.getByText('Submitted · waiting for review')).toBeVisible()

  // --- My tutorials --------------------------------------------------------
  await page.goto('/tutorials')
  await expect(page.getByText(title)).toBeVisible()
  // Badge uppercases the status string itself.
  await expect(page.getByText('PENDING')).toBeVisible()
})
