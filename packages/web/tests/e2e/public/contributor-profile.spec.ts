import { test, expect } from '@playwright/test'
import { acceptTerms, createContributor, createTutorial, signIn, uniqueTitle } from '../helpers'

async function maker() {
  const person = await createContributor()
  await acceptTerms(person.id)
  const title = uniqueTitle('E2E Profile Guide')
  const guideId = await createTutorial(person.id, { title, status: 'approved' })
  return { person, title, guideId }
}

test('WP01 a contributor with a published guide has a public profile; one without any contribution is a 404', async ({ page }) => {
  const { person } = await maker()
  await page.goto(`/contributors/${person.id}`)
  await expect(page.getByRole('heading', { level: 1, name: person.name })).toBeVisible()
  await expect(page.getByTestId('contributor-stat-tutorials')).toContainText('1')
  await expect(page.getByTestId('contributor-stat-toys-shared')).toContainText('0')

  const quiet = await createContributor()
  expect((await page.goto(`/contributors/${quiet.id}`))?.status()).toBe(404)
})

test('WP02 the guide card opens the guide, and the breadcrumb leads to Impact', async ({ page }) => {
  const { person, title, guideId } = await maker()
  await page.goto(`/contributors/${person.id}`)
  await page.locator('#ctb-guides').getByRole('link', { name: new RegExp(title) }).click()
  await expect(page).toHaveURL(new RegExp(`/tutorials/${guideId}$`))

  await page.goto(`/contributors/${person.id}`)
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Impact' }).click()
  await expect(page).toHaveURL(/\/impact$/)
})

test('WP03 "Ask {first} to build a guide" goes through sign up for a visitor and to the request form for a Member', async ({ page }) => {
  const { person } = await maker()
  const first = person.name.split(' ')[0]
  await page.goto(`/contributors/${person.id}`)
  await page.getByRole('link', { name: `Ask ${first} to build a guide` }).click()
  await expect(page).toHaveURL(/\/signup\?next=/)

  const asker = await createContributor()
  await signIn(page, asker.email, asker.password)
  await page.goto(`/contributors/${person.id}`)
  await page.getByRole('link', { name: `Ask ${first} to build a guide` }).click()
  await expect(page).toHaveURL(new RegExp(`/get-involved/requests/new\\?maker=${person.id}$`))
})

test('WP04 a Member thanks a contributor with a note: it shows once, the contributor is told without a name, and reads the note', async ({ page, browser }) => {
  const { person } = await maker()
  const reader = await createContributor()
  await signIn(page, reader.email, reader.password)
  await page.goto(`/contributors/${person.id}`)
  await page.getByRole('button', { name: /Say thanks to/ }).click()
  await page.getByLabel('Add a note (optional)').fill('Your drum made bedtime easier.')
  await page.getByRole('button', { name: 'Send thanks' }).click()
  await expect(page.getByRole('status')).toHaveText('Thanks sent — they will see it in their notifications')
  await expect(page.getByRole('button', { name: 'Thanked' })).toBeDisabled()

  const owner = await browser.newContext()
  const ownerPage = await owner.newPage()
  await signIn(ownerPage, person.email, person.password)
  await ownerPage.goto('/notifications')
  await expect(ownerPage.getByText("A family said thanks to you")).toBeVisible()
  await ownerPage.goto('/dashboard/thanks')
  await expect(ownerPage.getByText('Your drum made bedtime easier.')).toBeVisible()
  await owner.close()
})

test('WP05 a signed-out visitor who tries to say thanks is sent to sign up, carrying the profile', async ({ page }) => {
  const { person } = await maker()
  await page.goto(`/contributors/${person.id}`)
  await page.getByRole('button', { name: /Say thanks to/ }).click()
  await expect(page).toHaveURL(new RegExp(`/signup\\?next=%2Fcontributors%2F${person.id}&reason=thanks`))
})
