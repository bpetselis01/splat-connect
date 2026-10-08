// journeys: G09
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signIn, signInAsNewContributor, uniqueTitle } from './helpers'

// Thanks from a guide page (066): once per person, named for the author's
// first name, never on your own guide.

/** A one-word first name only this spec's fixture answers to. */
const firstName = () => `Wren${Date.now()}${Math.floor(Math.random() * 1e4)}`

test('a reader thanks the author: toast, Thanked, and a reload keeps it', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const author = await createContributor()
  const first = firstName()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Thanked Guide'), contributorName: `${first} Tester` })

  await page.goto(`/guides/${id}`)
  const thank = page.getByRole('button', { name: `Thank ${first}`, exact: true })
  await expect(thank).toBeVisible()
  const posted = page.waitForResponse((r) => r.url().endsWith(`/api/tutorials/${id}/thanks`) && r.request().method() === 'POST')
  await thank.click()
  expect((await posted).status()).toBe(201)

  await expect(page.getByText(`Thanks sent to ${first}`)).toBeVisible()
  await expect(page.getByRole('button', { name: `Thanked ${first}`, exact: true })).toBeVisible()
  await expect(thank).toHaveCount(0)

  const { data } = await adminClient().from('tutorial_thanks').select('profile_id').eq('tutorial_id', id)
  expect(data).toEqual([{ profile_id: reader.id }])

  // The reload is the proof: only a fresh GET /thanks says it is kept.
  await page.reload()
  await expect(page.getByRole('button', { name: `Thanked ${first}`, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Thank ${first}`, exact: true })).toHaveCount(0)

  // Tapping the filled button says so and sends nothing more.
  await page.getByRole('button', { name: `Thanked ${first}`, exact: true }).click()
  await expect(page.getByText(`You already thanked ${first}`)).toBeVisible()
  const { data: after } = await adminClient().from('tutorial_thanks').select('profile_id').eq('tutorial_id', id)
  expect(after).toHaveLength(1)
})

test('the author sees no Thank button on their own guide, but still has Save and Report', async ({ page }) => {
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Own Guide'), contributorName: `${firstName()} Maker` })
  await signIn(page, author.email, author.password)
  await page.waitForURL(/\/home$/)

  // Wait for the thanks answer: before it lands the button is hidden for every viewer.
  const answered = page.waitForResponse((r) => r.url().endsWith(`/api/tutorials/${id}/thanks`) && r.request().method() === 'GET')
  await page.goto(`/guides/${id}`)
  expect(await (await answered).json()).toEqual({ thanked: false, own: true })

  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Report a problem', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Thank/ })).toHaveCount(0)
})

test('a thank that fails says so and the button stays Thank', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const first = firstName()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Thank Fails'), contributorName: `${first} Tester` })

  await page.goto(`/guides/${id}`)
  await expect(page.getByRole('button', { name: `Thank ${first}`, exact: true })).toBeVisible()
  await page.route(`**/api/tutorials/${id}/thanks`, (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }) : route.continue()
  )
  await page.getByRole('button', { name: `Thank ${first}`, exact: true }).click()

  await expect(page.getByText('Could not send that. Try again.')).toBeVisible()
  await expect(page.getByRole('button', { name: `Thank ${first}`, exact: true })).toBeVisible()
  const { data } = await adminClient().from('tutorial_thanks').select('profile_id').eq('tutorial_id', id)
  expect(data).toEqual([])
})
