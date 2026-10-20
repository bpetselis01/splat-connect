import { test, expect, type Page } from '@playwright/test'
import { createContributor, signIn, signInAsNewContributor } from './helpers'

/**
 * Home shortcuts are kept on the device per member (lib/home-shortcuts.ts). The
 * unit tests drive the hook against an in-memory disk; this runs the real
 * localStorage adapter and a real reload.
 */

const tile = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

async function removeFromHome(page: Page, name: string) {
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('button', { name: `Remove ${name} from Home` }).click()
  await page.getByRole('button', { name: 'Done' }).click()
}

/** Drop the Supabase session only, so the next sign-in is a different member on the same browser. */
async function signOutKeepingDeviceData(page: Page) {
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('sb-')) localStorage.removeItem(k)
  })
}

test('H04 a removed shortcut is still gone after a reload, and is kept under this member\'s own key', async ({ page }) => {
  const member = await signInAsNewContributor(page)
  await page.goto('/home')
  await expect(tile(page, 'Events')).toBeVisible()

  await removeFromHome(page, 'Events')
  await expect(tile(page, 'Events')).toBeHidden()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
  await expect(tile(page, 'Events')).toBeHidden()
  await expect(tile(page, 'Guides')).toBeVisible()

  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('home-shortcuts.')))
  expect(keys).toEqual([`home-shortcuts.${member.id}`])
})

test('another member on the same browser still sees the default shortcuts, and the first member\'s change is waiting for them', async ({ page }) => {
  const first = await signInAsNewContributor(page)
  await page.goto('/home')
  await removeFromHome(page, 'Events')
  await expect(tile(page, 'Events')).toBeHidden()

  const second = await createContributor()
  await signOutKeepingDeviceData(page)
  await signIn(page, second.email, second.password)
  await expect(page).toHaveURL(/\/home$/)
  await expect(tile(page, 'Events')).toBeVisible()

  await signOutKeepingDeviceData(page)
  await signIn(page, first.email, first.password)
  await expect(page).toHaveURL(/\/home$/)
  await expect(tile(page, 'Events')).toBeHidden()
})

test('H05 a shortcut added from the sheet survives a reload and the sheet then offers to remove it', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/home')
  await expect(tile(page, 'Learn')).toBeHidden()

  await page.getByRole('button', { name: 'Add a shortcut' }).click()
  await page.getByLabel('Search features').fill('learn')
  await page.getByRole('button', { name: 'Add Learn to Home' }).click()
  // The Close backdrop fills the screen behind the sheet; tap its exposed top corner.
  await page.getByRole('button', { name: 'Close' }).first().click({ position: { x: 5, y: 5 } })
  await expect(tile(page, 'Learn')).toBeVisible()

  await page.reload()
  await expect(tile(page, 'Learn')).toBeVisible()

  await page.getByRole('button', { name: 'Add a shortcut' }).click()
  await page.getByLabel('Search features').fill('learn')
  await expect(page.getByRole('button', { name: 'Remove Learn from Home' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Learn to Home' })).toHaveCount(0)
})

test('corrupt device data falls back to the default eight rather than an empty or broken Home', async ({ page }) => {
  const member = await signInAsNewContributor(page)
  await page.goto('/home')
  await page.evaluate((id) => localStorage.setItem(`home-shortcuts.${id}`, '{"not":"an array"'), member.id)
  await page.reload()
  for (const name of ['Guides', 'Toys', 'Events', 'Recycling']) await expect(tile(page, name)).toBeVisible()
})
