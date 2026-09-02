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
  // The create action IS the corner button — it was a row inside the menu
  // until the front door of this flow turned out to be two taps deep.
  await page.getByRole('button', { name: 'Add a guide', exact: true }).click()
  await expect(page).toHaveURL(/\/guides\/new$/)

  await page.getByPlaceholder('Title').fill(title)
  await page.getByRole('button', { name: 'Create draft', exact: true }).click()

  // The signup form already accepted the contributor terms, so POST
  // /api/tutorials is not gated and the draft opens straight away — onto the
  // hub, which says what is still missing before anything has been typed.
  await expect(page).toHaveURL(/\/tutorials\/[0-9a-f-]{36}/)
  const id = (page.url().split('/tutorials/')[1] ?? '').split(/[/?]/)[0]
  await expect(page.getByTestId('hub-created-note')).toBeVisible()
  await expect(page.getByTestId('hub-submit')).toBeDisabled()

  // Every save below is waited out rather than fired and forgotten: each PATCH
  // carries the updated_at the screen last saw, and a stale one comes back 400
  // — so a write has to be merged back into state before the next one starts.
  // Autosave makes the writes closer together, so this matters more, not less.
  const patched = () =>
    page.waitForResponse(
      (r) => r.url().includes(`/api/tutorials/${id}`) && r.request().method() === 'PATCH'
    )
  // The replace-set sub-resources answer 201, not 200 — one shared handler in
  // packages/api/src/routes/sub-resource.ts serves parts, tools and stl-files.
  const posted = (sub: string) =>
    page.waitForResponse(
      (r) => r.url().includes(`/api/tutorials/${id}/${sub}`) && r.request().method() === 'POST'
    )
  // Every section ends in the same pair. "Checklist" is the way back; the
  // native chevron still works, but this is the control a contributor sees.
  const backToHub = async () => {
    await page.getByTestId('section-back').click()
    await expect(page.getByTestId('hub-submit')).toBeVisible()
  }

  // --- Details -----------------------------------------------------------
  await page.getByTestId('hub-row-details').click()
  let saved = patched()
  await page.getByLabel('Description').fill('Written by a Playwright E2E test.')
  expect((await saved).status()).toBe(200)
  await backToHub()

  // --- Safety ------------------------------------------------------------
  // Its own screen now, and its own gate: nothing submits without it.
  await page.getByTestId('hub-row-safety').click()
  saved = patched()
  await page.getByTestId('safety-declare').click()
  expect((await saved).status()).toBe(200)
  await backToHub()
  await expect(page.getByTestId('hub-row-safety')).toContainText('Declared')
  // The note is for the moment of arrival. Having opened two sections, the
  // contributor has plainly found them, and it stops holding the top of the hub.
  await expect(page.getByTestId('hub-created-note')).toBeHidden()

  // --- Parts -------------------------------------------------------------
  await page.getByTestId('hub-row-parts').click()
  await page.getByRole('button', { name: '+ Add a part', exact: true }).click()
  let itemsSaved = posted('parts')
  await page.getByLabel('Part 1 name').fill('Micro switch')
  expect((await itemsSaved).status()).toBe(201)
  itemsSaved = posted('parts')
  await page.getByRole('button', { name: 'Increase quantity for part 1' }).click()
  expect((await itemsSaved).status()).toBe(201)
  await backToHub()
  // The assertion the old rail could not make: the hub reports what a section
  // holds without being asked to refetch.
  await expect(page.getByTestId('hub-row-parts')).toContainText('1 part')

  // --- Tools -------------------------------------------------------------
  await page.getByTestId('hub-row-tools').click()
  await page.getByRole('button', { name: '+ Add a tool', exact: true }).click()
  itemsSaved = posted('tools')
  await page.getByLabel('Tool 1 name').fill('Soldering iron')
  expect((await itemsSaved).status()).toBe(201)
  await backToHub()
  await expect(page.getByTestId('hub-row-tools')).toContainText('1 tool')

  // Files still hold Submit shut.
  await expect(page.getByTestId('hub-row-files')).toContainText('Guide PDF and a photo')
  await expect(page.getByTestId('hub-submit')).toBeDisabled()

  // --- Files -------------------------------------------------------------
  await page.getByTestId('hub-row-files').click()
  await expect(page.getByText('No PDF yet')).toBeVisible()

  await chooseFile(page, 'Choose PDF from Files', PDF_FIXTURE)
  // /api/upload/pdf always writes <id>/tutorial.pdf, and the row's label is the
  // stored path's last segment. Its arrival means the PATCH committed too, so
  // the next save is working from a fresh updated_at.
  await expect(page.getByText('tutorial.pdf')).toBeVisible()

  await chooseFile(page, 'Choose from library', PHOTO_FIXTURE)
  await backToHub()
  await expect(page.getByTestId('hub-row-files')).toContainText('PDF and photo added')

  // --- Submit, from the hub ----------------------------------------------
  await expect(page.getByText('5 of 5 ready')).toBeVisible()
  const submit = page.getByTestId('hub-submit')
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(page.getByText('Submitted - waiting for review')).toBeVisible()

  // --- My tutorials --------------------------------------------------------
  await page.goto('/tutorials')
  await expect(page.getByText(title)).toBeVisible()
  // Badge uppercases the status string itself.
  await expect(page.getByText('PENDING')).toBeVisible()
})
