import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, deleteUser, signIn } from '../helpers'

async function childRows(parentId: string) {
  const { data } = await adminClient().from('child_profiles').select('age, helps_with, everyday_needs').eq('parent_id', parentId)
  return data
}

async function openWizard(page: import('@playwright/test').Page) {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto('/onboarding/child')
  await expect(page.getByRole('heading', { level: 1, name: 'How old is your child?' })).toBeVisible()
  // Filled and clicked only once React is attached, or the change never reaches state.
  await page.waitForLoadState('networkidle')
  return contributor
}

test('WA19 Continue saves each answered step and Finish opens the guides', async ({ page }) => {
  const { id } = await openWizard(page)
  try {
    await page.getByLabel('Age in years').fill('6')
    await page.getByRole('button', { name: /Continue/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'What would help your child day to day?' })).toBeVisible()
    expect(await childRows(id)).toEqual([{ age: 6, helps_with: [], everyday_needs: [] }])

    await page.getByRole('button', { name: 'Seeing' }).click()
    await page.getByRole('button', { name: /Continue/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'How does your child start or control things?' })).toBeVisible()
    expect(await childRows(id)).toEqual([{ age: 6, helps_with: ['seeing'], everyday_needs: [] }])

    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Good to know' })).toBeVisible()
    await page.getByRole('button', { name: 'Quiet toys only' }).click()
    await page.getByRole('button', { name: /Finish/ }).click()

    await page.waitForURL('**/library')
    expect(await childRows(id)).toEqual([{ age: 6, helps_with: ['seeing'], everyday_needs: ['quiet'] }])
  } finally {
    await deleteUser(id)
  }
})

test('WA20 Skip saves nothing, Back returns a question, and skipping the last one opens the guides', async ({ page }) => {
  const { id } = await openWizard(page)
  try {
    await expect(page.getByRole('button', { name: 'Back' })).toBeDisabled()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'What would help your child day to day?' })).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'How old is your child?' })).toBeVisible()

    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Skip' }).click()
    await page.waitForURL('**/library')
    expect(await childRows(id)).toEqual([])
  } finally {
    await deleteUser(id)
  }
})

test('WA20 Back to guides leaves the wizard for /library', async ({ page }) => {
  const { id } = await openWizard(page)
  try {
    await page.getByRole('link', { name: 'Back to guides' }).click()
    await expect(page).toHaveURL(/\/library$/)
  } finally {
    await deleteUser(id)
  }
})

test('WA21 a signed-out visitor is sent to /login with the wizard as ?next=', async ({ page }) => {
  await page.goto('/onboarding/child')
  await expect(page).toHaveURL(/\/login\?next=%2Fonboarding%2Fchild$/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
