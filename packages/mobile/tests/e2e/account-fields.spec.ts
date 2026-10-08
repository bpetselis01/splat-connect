// journeys: A12 Z02 Z08 Z10
import { test, expect, type Page } from '@playwright/test'
import { adminClient, signIn, signInAsNewContributor, openChildProfile } from './helpers'
import { createUserWithoutTerms, idAfter } from './family-fixtures'

// The Account screen: the terms gate's Sign out, "What you do", the web links,
// and deleting a child profile. react-native-web never fires onEndEditing, so
// the field is driven with Return (onSubmitEditing), as the name and postcode are.

test('"What you do" saves on Return, shows after a reload, and clears to null when emptied', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  await page.goto('/account')
  const field = page.getByLabel('What you do', { exact: true })
  const patched = () => page.waitForResponse((r) => r.url().includes('/api/contributors/me') && r.request().method() === 'PATCH')
  const occupation = async () => (await adminClient().from('profiles').select('occupation').eq('id', me.id).single()).data?.occupation

  let saved = patched()
  await field.fill('Occupational therapist')
  await field.press('Enter')
  expect((await saved).status()).toBe(200)
  expect(await occupation()).toBe('Occupational therapist')
  await page.reload()
  await expect(field).toHaveValue('Occupational therapist')

  saved = patched()
  await field.fill('')
  await field.press('Enter')
  expect((await saved).status()).toBe(200)
  expect(await occupation()).toBeNull()
})

/** Stub window.open so a link's target can be read instead of followed. */
async function captureOpens(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { opened: string[] }
    w.opened = []
    window.open = (u?: string | URL) => (w.opened.push(String(u)), null)
  })
  return () => page.evaluate(() => (window as unknown as { opened: string[] }).opened)
}

test('an account that never accepted the terms is held at /terms and can sign out', async ({ page }) => {
  const user = await createUserWithoutTerms()
  await signIn(page, user.email, user.password)
  await expect(page).toHaveURL(/\/terms$/)
  await expect(page.getByRole('heading', { name: 'Contributor terms' })).toBeVisible()

  await page.getByText('Sign out', { exact: true }).click()
  await expect(page).toHaveURL(/\/(welcome|sign-in)/)
  // Signed out for real: the gate no longer lets a deep link through.
  await page.goto('/account')
  await expect(page).not.toHaveURL(/\/account$/)
})

test('Open Web Dashboard and the privacy links go to the web pages', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/account')
  const opened = await captureOpens(page)

  await page.getByRole('button', { name: 'Open Web Dashboard', exact: true }).click()
  expect((await opened()).at(-1)).toMatch(/\/dashboard$/)

  await page.getByText('privacy policy', { exact: true }).click()
  expect((await opened()).at(-1)).toMatch(/\/privacy$/)

  // And the same link on a child's own page.
  await page.getByRole('button', { name: '+ Add a child' }).click()
  await expect(page.getByText('Delete profile')).toBeVisible()
  const openedOnChild = await captureOpens(page)
  // The account page stays mounted under the child's, so the child's own link is the last match.
  await page.getByText('privacy policy', { exact: true }).last().click()
  expect((await openedOnChild()).at(-1)).toMatch(/\/privacy$/)
})

test('Delete profile asks first; cancelling keeps the child, confirming removes the row', async ({ page }) => {
  await signInAsNewContributor(page)
  await openChildProfile(page)
  const childId = idAfter(page, '/account/child/')
  const exists = async () => {
    const { data } = await adminClient().from('child_profiles').select('id').eq('id', childId)
    return data?.length ?? 0
  }
  expect(await exists()).toBe(1)

  page.once('dialog', (d) => void d.dismiss())
  await page.getByRole('button', { name: 'Delete profile', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Delete profile', exact: true })).toBeVisible()
  expect(await exists()).toBe(1)

  page.once('dialog', (d) => void d.accept())
  const deleted = page.waitForResponse((r) => r.url().includes(`/api/child-profiles/${childId}`) && r.request().method() === 'DELETE')
  await page.getByRole('button', { name: 'Delete profile', exact: true }).click()
  expect([200, 204]).toContain((await deleted).status())
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByText(/No child profiles yet/)).toBeVisible()
  expect(await exists()).toBe(0)
})
