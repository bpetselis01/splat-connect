import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createPublishedToy, pickFilter, renameProfile, setPickupAddress, signIn, uniqueTitle } from './helpers'

/**
 * What an Account edit changes elsewhere, without a reload: the greeting on
 * Me after a rename, and the distance on a toy card after a postcode.
 * Navigation is in-app only (tab bar, rows, the Home shortcut), and each
 * check reads the profiles row the edit wrote.
 */

async function profileRow(id: string) {
  const { data, error } = await adminClient().from('profiles').select('name, pickup_postcode').eq('id', id).single()
  if (error || !data) throw new Error(`profileRow failed: ${error?.message}`)
  return data
}

test('Z01 renaming on Account changes the greeting on Me', async ({ page }) => {
  const user = await createContributor()
  await renameProfile(user.id, 'Alba Quokka')
  await signIn(page, user.email, user.password)
  await expect(page).toHaveURL(/\/home$/)
  await page.getByRole('tab', { name: /^Me(,|$)/ }).click()
  await expect(page.getByText('Hi, Alba', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  const field = page.getByLabel('Display name', { exact: true })
  await field.fill('Beryl Wombat')
  await field.press('Enter')
  await expect.poll(async () => (await profileRow(user.id)).name).toBe('Beryl Wombat')
  expect((await profileRow(user.id)).name).toBe('Beryl Wombat')

  await page.goBack()
  await expect(page.getByText('Hi, Beryl', { exact: true })).toBeVisible()
  await expect(page.getByText('Hi, Alba', { exact: true })).toHaveCount(0)
})

test('Z03 a postcode on Account puts a distance on the toy card, and a new postcode changes it', async ({ page }) => {
  const owner = await createContributor()
  await setPickupAddress(owner.id, { pickup_line1: '1 Test St', pickup_suburb: 'Melbourne', pickup_state: 'VIC', pickup_postcode: '3000' })
  const toy = uniqueTitle('E2E Distance Toy')
  await createPublishedToy(owner.id, { name: toy })

  const viewer = await createContributor()
  await signIn(page, viewer.email, viewer.password)
  await expect(page).toHaveURL(/\/home$/)
  await page.getByRole('button', { name: 'Toys', exact: true }).click()
  await page.getByPlaceholder('Search toys').fill(toy)
  const card0 = page.getByRole('button', { name: toy })
  await expect(card0).toBeVisible()
  await expect(card0.getByText(/ km$/)).toHaveCount(0)

  const setPostcode = async (postcode: string) => {
    await page.getByRole('tab', { name: /^Me(,|$)/ }).click()
    await page.getByRole('button', { name: 'Account', exact: true }).click()
    await expect(page).toHaveURL(/\/account$/)
    const field = page.getByLabel('Postcode', { exact: true })
    await field.fill(postcode)
    await field.press('Enter')
    await expect.poll(async () => (await profileRow(viewer.id)).pickup_postcode).toBe(postcode)
    await page.goBack()
    await page.getByRole('tab', { name: 'Home' }).click()
    await page.getByRole('button', { name: 'Toys', exact: true }).click()
  }

  // Z03: Melbourne CBD to Richmond is a few km; "Nearest first" only exists once there is a postcode.
  await setPostcode('3141')
  await pickFilter(page, 'Nearest first')
  const card = page.getByRole('button', { name: toy })
  const km = card.getByText(/^\d+ km$/)
  await expect(km).toBeVisible()
  const near = Number((await km.innerText()).replace(' km', ''))
  expect(near).toBeLessThan(10)

  // The library remounts when Home opens it again, so Nearest first is picked again.
  await setPostcode('2000')
  await pickFilter(page, 'Nearest first')
  await expect(card.getByText(/^\d{3,} km$/)).toBeVisible()
  expect(Number((await km.innerText()).replace(' km', ''))).toBeGreaterThan(500)
})
