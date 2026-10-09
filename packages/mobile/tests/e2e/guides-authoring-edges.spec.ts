// journeys: N03 N06 T01 T03 T04 T06 T08 T10 T13 T14 T15 T20 T22
import { test, expect, type Page } from '@playwright/test'
import { createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { addSteps, rejectWithNote } from './guides-fixtures'

// The editor around its edges: autosave and recovery, steps, deleting a draft,
// refused uploads, and a returned guide. Complements guides-authoring.spec.ts's
// one happy path. Same fixtures as that spec; paths, not buffers (no @types/node).
const PDF_FIXTURE = 'tests/e2e/fixtures/test.pdf'
const PHOTO_FIXTURE = 'tests/e2e/fixtures/test.jpg'

async function chooseFile(page: Page, button: string, file: string) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: button, exact: true }).click()
  await (await chooser).setFiles(file)
}

const patched = (page: Page, id: string) =>
  page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}`) && r.request().method() === 'PATCH')

test('Create draft stays off for a title of only spaces', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/guides/new')
  await page.getByPlaceholder('Title').fill('     ')
  await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toBeDisabled()
})

test('a title with quotes, markup, an emoji and 120 characters becomes a draft that keeps it', async ({ page }) => {
  await signInAsNewContributor(page)
  const title = uniqueTitle(`E2E "Draft" <i>&</i> 🧸 ${'y'.repeat(100)}`)
  await page.goto('/guides/new')
  await page.getByPlaceholder('Title').fill(title)
  await page.getByRole('button', { name: 'Create draft', exact: true }).click()
  await expect(page).toHaveURL(/\/tutorials\/[0-9a-f-]{36}/)
  await expect(page.getByText(title)).toBeVisible()
})

test('an edit made in a section is still there after a reload (draft recovery)', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile Recover'), status: 'draft' })

  await page.goto(`/tutorials/${id}/details`)
  const saved = patched(page, id)
  await page.getByLabel('Description').fill('Typed, then the page was reloaded.')
  expect((await saved).status()).toBe(200)

  await page.reload()
  await expect(page.getByLabel('Description')).toHaveValue('Typed, then the page was reloaded.')
})

test('leaving a section straight after typing still saves it', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile FlushOnLeave'), status: 'draft' })

  await page.goto(`/tutorials/${id}/details`)
  const saved = patched(page, id)
  await page.getByLabel('Description').fill('Saved by leaving')
  // Under the 250 ms debounce: the Checklist hop has to flush first.
  await page.getByTestId('section-back').click()
  expect((await saved).status()).toBe(200)
  await page.goto(`/tutorials/${id}/details`)
  await expect(page.getByLabel('Description')).toHaveValue('Saved by leaving')
})

test('a failed autosave says so and keeps the typed words on screen', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile SaveFails'), status: 'draft' })

  await page.goto(`/tutorials/${id}/details`)
  await page.route(`**/api/tutorials/${id}`, (route) => (route.request().method() === 'PATCH' ? route.abort() : route.continue()))
  await page.getByLabel('Description').fill('Not saved yet')
  await expect(page.getByText('Could not save. Your changes are still here - try again.')).toBeVisible()
  await expect(page.getByLabel('Description')).toHaveValue('Not saved yet')

  // Back online: the next edit sends the earlier one with it.
  await page.unroute(`**/api/tutorials/${id}`)
  const saved = patched(page, id)
  await page.getByLabel('Title').fill(`${uniqueTitle('E2E Mobile Retitled')}`)
  expect((await saved).status()).toBe(200)
  await page.reload()
  await expect(page.getByLabel('Description')).toHaveValue('Not saved yet')
})

test('steps added in the editor are saved in order and survive a reload', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile EditSteps'), status: 'draft' })

  await page.goto(`/tutorials/${id}/steps`)
  // A PDF-only guide opens on the choice card; the editor is one tap further.
  await page.getByRole('button', { name: 'Add steps as well', exact: true }).click()
  await page.getByTestId('steps-add').click()
  await page.getByLabel('Step 1 instructions').fill('First, open it.')
  await page.getByTestId('steps-add').click()
  const put = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/steps`) && r.request().method() === 'PUT')
  await page.getByLabel('Step 2 instructions').fill('Then close it.')
  expect((await put).status()).toBe(200)

  await page.reload()
  await expect(page.getByLabel('Step 1 instructions')).toHaveValue('First, open it.')
  await expect(page.getByLabel('Step 2 instructions')).toHaveValue('Then close it.')
})

test('moving a step down swaps the two and saves the new order', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile MoveStep'), status: 'draft' })
  await addSteps(id, [{ body: 'Alpha' }, { body: 'Bravo' }])

  await page.goto(`/tutorials/${id}/steps`)
  const put = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/steps`) && r.request().method() === 'PUT')
  await page.getByTestId('step-down-0').click()
  expect((await put).status()).toBe(200)
  await page.reload()
  await expect(page.getByLabel('Step 1 instructions')).toHaveValue('Bravo')
  await expect(page.getByLabel('Step 2 instructions')).toHaveValue('Alpha')
})

test('a step with no instructions is flagged and never saved', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile BlankStep'), status: 'draft' })

  await page.goto(`/tutorials/${id}/steps`)
  // A PDF-only guide opens on the choice card; the editor is one tap further.
  await page.getByRole('button', { name: 'Add steps as well', exact: true }).click()
  await page.getByTestId('steps-add').click()
  await expect(page.getByText('Add the instructions to save this step')).toBeVisible()
  await page.getByTestId('section-back').click()
  await page.goto(`/tutorials/${id}/steps`)
  await expect(page.getByTestId('step-row-0')).toHaveCount(0)
})

test('the hub counts steps, and steps alone open Submit', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile HubSteps'), status: 'draft', withPdf: false, withSteps: false, buildMinutes: 30 })

  await page.goto(`/tutorials/${id}`)
  await expect(page.getByTestId('hub-submit')).toBeDisabled()

  await addSteps(id, [{ body: 'One' }, { body: 'Two' }, { body: 'Three' }])
  await page.reload()
  await expect(page.getByTestId('hub-row-steps')).toContainText('3 steps')
  await expect(page.getByTestId('hub-submit')).toBeEnabled()
})

test('a guide PDF alone opens Submit', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile HubPdfOnly'), status: 'draft', withPdf: true, withSteps: false, buildMinutes: 30 })

  await page.goto(`/tutorials/${id}`)
  await expect(page.getByTestId('hub-submit')).toBeEnabled()
})

test('Delete draft asks first, and cancelling keeps the draft', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile KeepDraft')
  const id = await createTutorial(contributor.id, { title, status: 'draft' })

  await page.goto(`/tutorials/${id}`)
  page.once('dialog', (d) => void d.dismiss())
  await page.getByTestId('hub-menu-trigger').click()
  await page.getByTestId('hub-menu-delete').click()

  await expect(page).toHaveURL(new RegExp(`/tutorials/${id}`))
  await page.goto('/tutorials')
  await expect(page.getByText(title)).toBeVisible()
})

test('Delete draft, once confirmed, removes it from My tutorials', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile GoneDraft')
  const id = await createTutorial(contributor.id, { title, status: 'draft' })

  await page.goto(`/tutorials/${id}`)
  page.once('dialog', (d) => void d.accept())
  const del = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}`) && r.request().method() === 'DELETE')
  await page.getByTestId('hub-menu-trigger').click()
  await page.getByTestId('hub-menu-delete').click()
  expect([200, 204]).toContain((await del).status())

  await expect(page).toHaveURL(/\/tutorials$/)
  await expect(page.getByText(title)).toHaveCount(0)
})

test('a guide already submitted offers no Delete draft', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile Submitted'), status: 'pending' })

  await page.goto(`/tutorials/${id}`)
  await expect(page.getByText('Submitted - waiting for review')).toBeVisible()
  await page.getByTestId('hub-menu-trigger').click()
  await expect(page.getByTestId('hub-menu-delete')).toHaveCount(0)
  await expect(page.getByTestId('hub-submit')).toBeDisabled()
})

test('a returned guide shows the reviewer’s reason in My tutorials, quotes and all', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile Returned'), status: 'draft' })
  const note = `Add a photo of the "jack" <close up> & the lid 🧸`
  await rejectWithNote(id, note)

  await page.goto('/tutorials')
  await expect(page.getByText(note)).toBeVisible()
})

test('editing a returned guide sends it back for review without a Submit tap', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile Resubmit'), status: 'draft' })
  await rejectWithNote(id, 'Please describe it.')

  await page.goto(`/tutorials/${id}/details`)
  const saved = patched(page, id)
  await page.getByLabel('Description').fill('Now described.')
  const body = (await saved).request().postDataJSON() as { status?: string }
  expect(body.status).toBe('pending')
})

test('choosing a photo as the guide PDF is refused and the guide keeps no PDF', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile WrongPdf'), status: 'draft', withPdf: false })

  await page.goto(`/tutorials/${id}/files`)
  await expect(page.getByText('No PDF yet')).toBeVisible()
  await chooseFile(page, 'Choose PDF from Files', PHOTO_FIXTURE)
  await expect(page.getByText('Could not upload the PDF. Please try again.')).toBeVisible()
  await expect(page.getByText('No PDF yet')).toBeVisible()
})

test('choosing a PDF as the guide photo is refused and no photo is added', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile WrongPhoto'), status: 'draft' })

  await page.goto(`/tutorials/${id}/photos`)
  await chooseFile(page, 'Choose from library', PDF_FIXTURE)
  await expect(page.getByText('Could not upload the photo. Please try again.')).toBeVisible()
})

test('a photo upload that drops mid-way shows the error, and trying again works', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile DropUpload'), status: 'draft' })

  await page.goto(`/tutorials/${id}/photos`)
  await page.route('**/api/upload/photo', (route) => route.abort())
  await chooseFile(page, 'Choose from library', PHOTO_FIXTURE)
  await expect(page.getByText('Could not upload the photo. Please try again.')).toBeVisible()

  await page.unroute('**/api/upload/photo')
  await chooseFile(page, 'Choose from library', PHOTO_FIXTURE)
  await expect(page.getByText('Could not upload the photo. Please try again.')).toHaveCount(0)
  await expect(page.getByLabel('Caption for photo 2')).toBeVisible()
})

test('an assistive-tech guide opens its 3D print files section and refuses a non-STL file', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile Stl'), status: 'draft', kind: 'assistive_tech' })

  await page.goto(`/tutorials/${id}`)
  await expect(page.getByTestId('hub-row-stl')).toBeVisible()
  await page.getByTestId('hub-row-stl').click()
  await expect(page.getByText('No 3D-print files yet.')).toBeVisible()
  await chooseFile(page, 'Choose STL from Files', PHOTO_FIXTURE)
  await expect(page.getByText('Please choose a .stl file.')).toBeVisible()
})

test('a toy adaptation has no 3D print files row', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile NoStl'), status: 'draft', kind: 'toy_adaptation' })

  await page.goto(`/tutorials/${id}`)
  await expect(page.getByTestId('hub-row-details')).toBeVisible()
  await expect(page.getByTestId('hub-row-stl')).toHaveCount(0)
})

test('opening a section by deep link before the draft arrives still shows its saved content', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile DeepLink'), status: 'draft' })

  // Slow the load so the section mounts first; the gate must wait for the draft
  // rather than seed an empty list that its replace-set save would then write.
  await page.route(`**/api/tutorials/${id}`, async (route) => {
    if (route.request().method() === 'GET') await new Promise((r) => setTimeout(r, 800))
    await route.continue()
  })
  await page.goto(`/tutorials/${id}/parts`)
  await expect(page.getByLabel('Part 1 name')).toHaveValue('E2E part')
})
