import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signIn, signInAsNewContributor, uniqueTitle } from './helpers'

/**
 * Makers wanted end to end: a family posts a request (and the form's three
 * complaints, in order), a second maker sees it and claims it.
 *
 * Imports from helpers only, never from components.
 *
 * NOT covered: Ask first's two-sided thread (unit-tested, needs two live
 * sessions in one spec) and the working shot, whose photo comes from the OS
 * picker, which a web export cannot drive.
 */

async function postRequest(page: import('@playwright/test').Page, title: string) {
  await page.goto('/explore/makers-wanted/new')
  await page.getByLabel('Search guides').fill(title)
  await page.getByRole('radio', { name: title }).click()
  await page.getByPlaceholder('Newtown').fill('Glebe')
  await page.getByRole('checkbox', { name: /You cover the parts/ }).click()
  await page.getByRole('button', { name: 'Post to Makers wanted' }).click()
}

test('the ask form complains about the guide, then the suburb, then the parts promise, and posts nothing until all three are fixed', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Build Guide')
  await createTutorial(author.id, { title })

  await page.goto('/explore/makers-wanted/new')
  await page.getByRole('button', { name: 'Post to Makers wanted' }).click()
  await expect(page.getByText('Pick the guide you want built.')).toBeVisible()

  await page.getByLabel('Search guides').fill(title)
  await page.getByRole('radio', { name: title }).click()
  await page.getByRole('button', { name: 'Post to Makers wanted' }).click()
  await expect(page.getByText('Say which suburb you are in — never your address.')).toBeVisible()

  await page.getByPlaceholder('Newtown').fill('   ')
  await page.getByRole('button', { name: 'Post to Makers wanted' }).click()
  await expect(page.getByText('Say which suburb you are in — never your address.')).toBeVisible()

  await page.getByPlaceholder('Newtown').fill('Glebe')
  await page.getByRole('button', { name: 'Post to Makers wanted' }).click()
  await expect(page.getByText('Tick that you will cover the parts.')).toBeVisible()

  const { data } = await adminClient().from('toy_transactions').select('id').eq('requester_id', me.id).eq('type', 'build')
  expect(data).toEqual([])
})

test('a posted request is on the board for another maker, who claims it and lands in its thread', async ({ page, browser }) => {
  const family = await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Claimable Guide')
  await createTutorial(author.id, { title })

  await postRequest(page, title)
  await page.waitForURL(/\/explore\/makers-wanted/)
  await expect(page.getByText(title)).toBeVisible()

  const { data: rows } = await adminClient()
    .from('toy_transactions')
    .select('id, status, owner_id, requester_suburb, travel_km, urgency')
    .eq('requester_id', family.id)
    .eq('type', 'build')
  expect(rows).toEqual([
    expect.objectContaining({ status: 'requested', owner_id: null, requester_suburb: 'Glebe', travel_km: 10, urgency: 'No rush' }),
  ])

  const maker = await createContributor()
  const context = await browser.newContext()
  const makerPage = await context.newPage()
  await signIn(makerPage, maker.email, maker.password)
  await makerPage.waitForURL(/\/home$/)
  await makerPage.goto('/explore/makers-wanted')
  await expect(makerPage.getByText(title)).toBeVisible()
  await makerPage.getByRole('button', { name: "I'll build this" }).first().click()
  await makerPage.waitForURL(new RegExp(`/exchanges/build/${rows![0]!.id}$`))

  const { data: claimed } = await adminClient().from('toy_transactions').select('owner_id, status').eq('id', rows![0]!.id).single()
  expect(claimed).toEqual({ owner_id: maker.id, status: 'accepted' })
  await context.close()
})

test('a family cannot claim their own request, so it shows Track under Yours and no claim button', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Own Request Guide')
  await createTutorial(author.id, { title })

  await postRequest(page, title)
  await page.goto('/explore/makers-wanted?tab=mine')
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Track' })).toBeVisible()
  await expect(page.getByRole('button', { name: "I'll build this" })).toBeHidden()
})
