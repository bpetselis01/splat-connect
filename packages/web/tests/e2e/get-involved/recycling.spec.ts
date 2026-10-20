import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createOrg, deleteOrg, deleteUser, signIn, uniqueTitle } from '../helpers'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

/** An organisation that has said it takes PLA, so it shows up on the booking screen. */
async function recyclingOrg(name: string) {
  const id = await createOrg(name)
  const { error } = await adminClient().from('organizations').update({ recycling_materials: ['PLA'] }).eq('id', id)
  if (error) throw new Error(`recyclingOrg failed: ${error.message}`)
  return id
}

test('WI36 a signed-out visitor is offered sign-up, and a member goes to book a drop-off', async ({ page }) => {
  await page.goto('/get-involved/recycling')
  await page.getByRole('link', { name: 'Create an account to book a drop-off' }).click()
  await expect(page).toHaveURL(/\/signup$/)

  const member = await createContributor()
  try {
    await signIn(page, member.email, member.password)
    await page.goto('/get-involved/recycling')
    await expect(page.getByRole('link', { name: 'Create an account to book a drop-off' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Book a drop-off' }).click()
    await expect(page).toHaveURL(/\/get-involved\/recycling\/drop-off$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Book a drop-off' })).toBeVisible()
  } finally {
    await deleteUser(member.id)
  }
})

test('WI37 a member books a drop-off with a photo and the booking is stored for the organisation', async ({ page }) => {
  const member = await createContributor()
  await acceptTerms(member.id)
  const name = uniqueTitle('Northside Collective')
  const orgId = await recyclingOrg(name)
  try {
    await signIn(page, member.email, member.password)
    await page.goto(`/get-involved/recycling/drop-off?org=${orgId}`)
    await expect(page.getByRole('radio', { name: new RegExp(name) })).toBeChecked()
    const book = page.getByRole('button', { name: /Book the drop-off/ })
    await expect(book).toBeDisabled()
    await page.getByLabel('Photo of what you are bringing').setInputFiles({ name: 'bag.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByAltText('Photo of the sorted plastic')).toBeVisible()
    await page.getByPlaceholder('2.0').fill('2.5')
    for (const box of await page.getByRole('checkbox').all()) await box.check({ force: true })
    await book.click()

    await expect(page).toHaveURL(/\/dashboard$/)
    const { data } = await adminClient()
      .from('recycling_dropoffs')
      .select('org_id, contributor_id, material, estimated_grams, status, photo_url')
      .eq('org_id', orgId)
      .single()
    expect(data).toMatchObject({ org_id: orgId, contributor_id: member.id, material: 'PLA', estimated_grams: 2500, status: 'booked' })
    expect(data?.photo_url).toMatch(new RegExp(`${member.id}/`))
  } finally {
    await adminClient().from('recycling_dropoffs').delete().eq('org_id', orgId)
    await deleteOrg(orgId)
    await deleteUser(member.id)
  }
})

test('WI38 a signed-out visitor is sent to sign in, and the ?org= choice is lost on the way back', async ({ page }) => {
  await page.goto('/get-involved/recycling/drop-off?org=00000000-0000-0000-0000-000000000000')
  await expect(page).toHaveURL(/\/login\?next=%2Fget-involved%2Frecycling%2Fdrop-off$/)
})
