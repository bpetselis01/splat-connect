import path from 'node:path'
import { test, expect } from '@playwright/test'
import { signIn, createContributor, uniqueTitle } from '../helpers'

const PDF_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.pdf')
const PHOTO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.jpg')

test('a contributor completes the 6-step upload wizard and the tutorial appears as pending', async ({ page }) => {
  const contributor = await createContributor()
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

  await page.waitForURL('**/my-tutorials')
  const row = page.getByTestId('tutorial-row').filter({ hasText: title })
  await expect(row).toBeVisible()
  await expect(row.getByText('PENDING', { exact: true })).toBeVisible()
})
