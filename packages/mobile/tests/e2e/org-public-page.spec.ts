import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, makeOrgLeader, requestBacking, signIn, signInAsNewContributor, uniqueTitle } from './helpers'
import { seedOrgToy } from './org-fixtures'
import { seedPublicOrg } from './family-toys-fixtures'

/**
 * The organisation's public page: what loads for a family and for a leader of
 * it, and the guide and toy lists with their See all and row taps.
 */

const orgPath = (id: string) => `/toy-library/organisation/${id}`

test('P01 the page loads the organisation with its words, shows a family Follow and Message, and shows its own leader neither', async ({ page, browser, baseURL }) => {
  const leader = await createContributor()
  const org = await seedPublicOrg()
  await adminClient()
    .from('organizations')
    .update({ kind: 'University makerspace', suburb: 'Callaghan', state: 'NSW', about: 'Students adapting toys.' })
    .eq('id', org.id)
  await makeOrgLeader(leader.id, undefined, org.id)

  await signInAsNewContributor(page)
  await page.goto(orgPath(org.id))
  await expect(page.getByRole('heading', { name: org.name })).toBeVisible()
  await expect(page.getByText('University makerspace', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Callaghan, NSW', { exact: true })).toBeVisible()
  await expect(page.getByText('Students adapting toys.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Message', exact: true })).toBeVisible()

  const leaderContext = await browser.newContext({ baseURL })
  const leaderPage = await leaderContext.newPage()
  try {
    await signIn(leaderPage, leader.email, leader.password)
    await expect(leaderPage).toHaveURL(/\/home$/)
    await leaderPage.goto(orgPath(org.id))
    await expect(leaderPage.getByRole('heading', { name: org.name })).toBeVisible()
    await expect(leaderPage.getByText('Students adapting toys.')).toBeVisible()
    await expect(leaderPage.getByRole('button', { name: 'Follow', exact: true })).toHaveCount(0)
    await expect(leaderPage.getByRole('button', { name: 'Message', exact: true })).toHaveCount(0)
  } finally {
    await leaderContext.close()
  }
})

test('P08 the guide and toy lists show four rows, See all shows the rest, and a row opens its guide or toy', async ({ page }) => {
  await signInAsNewContributor(page)
  const org = await seedPublicOrg()
  const author = await createContributor()
  const guides: Array<{ id: string; title: string }> = []
  for (let i = 1; i <= 5; i++) {
    const title = uniqueTitle(`E2E Backed Guide ${i}`)
    const id = await createTutorial(author.id, { title })
    await requestBacking(id, org.id, 'accepted')
    guides.push({ id, title })
  }
  const toys: Array<{ id: string; name: string }> = []
  for (let i = 1; i <= 5; i++) {
    const name = uniqueTitle(`E2E Shelf Toy ${i}`)
    toys.push({ id: await seedOrgToy(org.id, { name }), name })
  }

  await page.goto(orgPath(org.id))
  await expect(page.getByText('Guides they back')).toBeVisible()
  const guideRows = page.getByRole('button', { name: /^E2E Backed Guide \d/ })
  await expect(guideRows).toHaveCount(4)
  await page.getByRole('button', { name: 'All 5 →' }).click()
  await expect(guideRows).toHaveCount(5)

  const toyRows = page.getByRole('button', { name: /^E2E Shelf Toy \d/ })
  await expect(toyRows).toHaveCount(4)
  await page.getByRole('button', { name: 'See all →' }).click()
  await expect(toyRows).toHaveCount(5)

  await page.getByRole('button', { name: guides[0]!.title }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${guides[0]!.id}$`))

  await page.goto(orgPath(org.id))
  await page.getByRole('button', { name: toys[0]!.name }).click()
  await expect(page).toHaveURL(new RegExp(`/toy-library/${toys[0]!.id}$`))
})
