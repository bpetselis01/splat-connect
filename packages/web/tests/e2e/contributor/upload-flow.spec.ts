import path from 'node:path'
import { test, expect } from '@playwright/test'
import { signIn, createContributor, uniqueTitle, adminClient, acceptTerms } from '../helpers'

const PDF_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.pdf')
const PHOTO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.jpg')

test('a contributor completes the 6-step upload wizard and the tutorial appears as pending', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')

  const title = uniqueTitle('E2E Upload Flow')
  await page.goto('/upload')

  // Step 1: Details
  await page.getByPlaceholder('e.g. Fisher-Price Piano').fill(title)
  await page.getByRole('button', { name: 'easy', exact: true }).click()
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 2: Files
  await page.locator('input[name="tutorial_pdf"]').setInputFiles(PDF_FIXTURE)
  await page.locator('input[name="toy_photo"]').setInputFiles(PHOTO_FIXTURE)
  await expect(page.getByRole('button', { name: 'Next →' })).toBeEnabled({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 3: Parts
  await page.getByRole('button', { name: '+ Add part' }).click()
  await page.getByPlaceholder('Part name *').fill('E2E test part')
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 4: Tools
  await page.getByRole('button', { name: '+ Add tool' }).click()
  await page.getByPlaceholder('Tool name *').fill('E2E test tool')
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 5: STL files (optional — skip)
  await page.getByRole('button', { name: 'Next →' }).click()

  // Step 6: Review & submit
  await expect(page.getByText(title)).toBeVisible()
  await page.getByRole('button', { name: 'Submit for review' }).click()

  await page.waitForURL('**/dashboard')
  const row = page.getByTestId('tutorial-row').filter({ hasText: title })
  await expect(row).toBeVisible()
  await expect(row.getByText('PENDING', { exact: true })).toBeVisible()
})

/**
 * Walk the wizard as far as `step`, uploading the file fixtures when passing
 * step 2 (canAdvanceFromStep(2) requires both URLs before Next enables).
 * Returns the generated title so callers can find the tutorial afterwards.
 */
async function walkTo(page: import('@playwright/test').Page, step: number, prefix: string) {
  const title = uniqueTitle(prefix)
  await page.goto('/upload')

  await page.getByPlaceholder('e.g. Fisher-Price Piano').fill(title)
  await page.getByRole('button', { name: 'easy', exact: true }).click()
  if (step === 1) return title
  await page.getByRole('button', { name: 'Next →' }).click()

  await expect(page.getByText('Step 2 of 6')).toBeVisible()
  if (step === 2) return title
  await page.locator('input[name="tutorial_pdf"]').setInputFiles(PDF_FIXTURE)
  await page.locator('input[name="toy_photo"]').setInputFiles(PHOTO_FIXTURE)
  await expect(page.getByRole('button', { name: 'Next →' })).toBeEnabled({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Next →' }).click()

  await expect(page.getByText('Step 3 of 6')).toBeVisible()
  if (step === 3) return title
  await page.getByRole('button', { name: '+ Add part' }).click()
  await page.getByPlaceholder('Part name *').fill('Walk-through part')
  await page.getByRole('button', { name: 'Next →' }).click()

  await expect(page.getByText('Step 4 of 6')).toBeVisible()
  if (step === 4) return title
  await page.getByRole('button', { name: '+ Add tool' }).click()
  await page.getByPlaceholder('Tool name *').fill('Walk-through tool')
  await page.getByRole('button', { name: 'Next →' }).click()

  await expect(page.getByText('Step 5 of 6')).toBeVisible()
  if (step === 5) return title
  await page.getByRole('button', { name: 'Next →' }).click()
  await expect(page.getByText('Step 6 of 6')).toBeVisible()
  return title
}

test('Next stays disabled until the required step-1 fields are filled', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto('/upload')

  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled()

  await page.getByPlaceholder('e.g. Fisher-Price Piano').fill(uniqueTitle('E2E Gate'))
  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled()

  await page.getByRole('button', { name: 'easy', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Next →' })).toBeEnabled()
})

test('Next stays disabled on step 2 until both files are uploaded', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await walkTo(page, 2, 'E2E File Gate')

  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled()

  await page.locator('input[name="tutorial_pdf"]').setInputFiles(PDF_FIXTURE)
  // The drop zone shows the picked filename (fileLabel ?? currentFileLabel),
  // so "PDF uploaded ✓" never appears once a file has been chosen locally.
  await expect(page.getByText('test.pdf')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled()

  await page.locator('input[name="toy_photo"]').setInputFiles(PHOTO_FIXTURE)
  await expect(page.getByRole('button', { name: 'Next →' })).toBeEnabled({ timeout: 20_000 })
})

test('Back preserves data already entered', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  const title = await walkTo(page, 2, 'E2E Back')

  await page.getByRole('button', { name: '← Back' }).click()

  await expect(page.getByText('Step 1 of 6')).toBeVisible()
  await expect(page.getByPlaceholder('e.g. Fisher-Price Piano')).toHaveValue(title)
  await expect(page.getByRole('button', { name: 'easy', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

test('re-advancing from step 1 updates the draft instead of creating a second', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  const original = await walkTo(page, 2, 'E2E Readvance')

  await page.getByRole('button', { name: '← Back' }).click()
  const renamed = `${original} renamed`
  await page.getByPlaceholder('e.g. Fisher-Price Piano').fill(renamed)
  await page.getByRole('button', { name: 'Next →' }).click()

  // A second POST with the same client-generated id would surface as an error
  // banner; a PATCH just advances.
  // Filtered to alerts with content: Next renders an empty role="alert" route
  // announcer outside <main>, which an unfiltered query also matches.
  await expect(page.getByText('Step 2 of 6')).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0)

  await expect
    .poll(async () => {
      const { data } = await adminClient().from('tutorials').select('id').eq('title', renamed)
      return data?.length ?? 0
    })
    .toBe(1)
  const { data: stale } = await adminClient().from('tutorials').select('id').eq('title', original)
  expect(stale).toHaveLength(0)
})

test('a part can be added and removed', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await walkTo(page, 3, 'E2E Part CRUD')

  await page.getByRole('button', { name: '+ Add part' }).click()
  await page.getByPlaceholder('Part name *').fill('Removable part')
  await expect(page.getByPlaceholder('Part name *')).toHaveCount(1)

  await page.getByRole('button', { name: 'Remove part' }).click()
  await expect(page.getByPlaceholder('Part name *')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled()
})

test('buy links can be added and removed on a part', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await walkTo(page, 3, 'E2E Buy Links')

  await page.getByRole('button', { name: '+ Add part' }).click()
  await page.getByPlaceholder('Part name *').fill('Part with links')

  await page.getByRole('button', { name: '+ Add buy link' }).click()
  await page.getByPlaceholder('Label (e.g. Jaycar)').fill('Jaycar')
  await page.getByPlaceholder('URL').fill('https://example.com/buy')
  await expect(page.getByPlaceholder('URL')).toHaveValue('https://example.com/buy')

  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.getByPlaceholder('URL')).toHaveCount(0)
})

test('a tool can be added and removed', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await walkTo(page, 4, 'E2E Tool CRUD')

  await page.getByRole('button', { name: '+ Add tool' }).click()
  await page.getByPlaceholder('Tool name *').fill('Removable tool')
  await expect(page.getByPlaceholder('Tool name *')).toHaveCount(1)

  await page.getByRole('button', { name: 'Remove tool' }).click()
  await expect(page.getByPlaceholder('Tool name *')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled()
})

test("a part's quantity and optional flag persist to the saved tutorial", async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  const title = await walkTo(page, 3, 'E2E Part Persist')

  await page.getByRole('button', { name: '+ Add part' }).click()
  await page.getByPlaceholder('Part name *').fill('Persisted part')
  await page.getByLabel('Quantity').fill('3')
  await page.getByText('Optional (not required)').click()
  await page.getByRole('button', { name: 'Next →' }).click()
  await expect(page.getByText('Step 4 of 6')).toBeVisible()

  const { data: tutorials } = await adminClient().from('tutorials').select('id').eq('title', title)
  const { data: parts } = await adminClient()
    .from('parts')
    .select('name,quantity,is_optional')
    .eq('tutorial_id', tutorials![0].id)

  expect(parts).toHaveLength(1)
  expect(parts![0]).toMatchObject({ name: 'Persisted part', quantity: 3, is_optional: true })
})

test('skipping step 5 saves no STL files', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  const title = await walkTo(page, 6, 'E2E Skip STL')

  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText('STL files:')).toBeVisible()

  const { data: tutorials } = await adminClient().from('tutorials').select('id').eq('title', title)
  const { data: stl } = await adminClient()
    .from('stl_files')
    .select('id')
    .eq('tutorial_id', tutorials![0].id)
  expect(stl).toHaveLength(0)
})
