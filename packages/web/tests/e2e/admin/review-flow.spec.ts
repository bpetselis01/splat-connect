import { test, expect } from '@playwright/test'
import { signIn, createContributor, createAdmin, createTutorial, uniqueTitle } from '../helpers'

test('an admin approves a pending tutorial and it appears in the public library', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const title = uniqueTitle('E2E Review Target Approve')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'pending' })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await page.goto('/admin/review')
  await page.getByRole('link', { name: new RegExp(title) }).click()
  await page.waitForURL(`**/admin/review/${tutorialId}`)

  await page.getByRole('button', { name: '✓ Approve — publish to library' }).click()
  await page.waitForLoadState('networkidle')

  await page.goto('/library')
  await expect(page.getByText(title)).toBeVisible()
})

test('an admin rejects a pending tutorial with a note visible to the contributor', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const title = uniqueTitle('E2E Review Target Reject')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'pending' })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto(`/admin/review/${tutorialId}`)
  await page.waitForLoadState('networkidle')

  await page.locator('textarea[name="note"]').fill('Needs clearer photos.')
  await page.getByRole('button', { name: '✕ Reject' }).click()
  await page.waitForLoadState('networkidle')

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await expect(page.getByText('Needs clearer photos.')).toBeVisible()
  await expect(page.getByText('REJECTED', { exact: true })).toBeVisible()
})

test('the review queue lists a pending tutorial with its submitted date', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const title = uniqueTitle('E2E Queue Listed')
  await createTutorial(contributor.id, { title, status: 'pending' })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto('/admin/review')

  const row = page.getByRole('link', { name: new RegExp(title) })
  await expect(row).toBeVisible()
  await expect(row).toContainText('Submitted')
})

test('the review detail page renders parts, tools, STL files and the PDF link', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Queue Detail'),
    status: 'pending',
  })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto(`/admin/review/${id}`)

  await expect(page.getByRole('link', { name: '📄 Open Tutorial PDF' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Parts \(/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Tools \(/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /STL Files \(/ })).toBeVisible()
  await expect(page.getByText('E2E part × 2')).toBeVisible()
  await expect(page.getByText('e2e-mount.stl')).toBeVisible()
})

test('a non-pending tutorial id 404s on the review detail page', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Already Approved'),
    status: 'approved',
  })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  const response = await page.goto(`/admin/review/${id}`)
  expect(response?.status()).toBe(404)
})

test('rejecting without a note shows the contributor the fallback text', async ({ page }) => {
  const contributor = await createContributor()
  const admin = await createAdmin()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Reject No Note'),
    status: 'pending',
  })

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto(`/admin/review/${id}`)
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: '✕ Reject' }).click()
  await page.waitForLoadState('networkidle')

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await expect(page.getByText('No feedback was provided.')).toBeVisible()
})
