import { test, expect } from '@playwright/test'
import { adminClient, signInAsNewContributor, uniqueTitle } from './helpers'
import { seedPublicOrg, sendReport } from './family-toys-fixtures'

/**
 * A family on an organisation's public page: Follow and unfollow, the Message,
 * Ask them to print and Book a drop-off buttons, each door row, Report, and the
 * Organisations list that leads there.
 */

const orgPath = (id: string) => `/toy-library/organisation/${id}`

test('P02 Follow writes the follow row, Following removes it, and a reload keeps the state', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const org = await seedPublicOrg()
  const follows = async () => {
    const { data } = await adminClient().from('org_follows').select('profile_id').eq('org_id', org.id)
    return data
  }

  await page.goto(orgPath(org.id))
  await page.getByRole('button', { name: 'Follow', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Following', exact: true })).toBeVisible()
  expect(await follows()).toEqual([{ profile_id: me.id }])

  await page.reload()
  await expect(page.getByRole('button', { name: 'Following', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Following', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible()
  expect(await follows()).toEqual([])
})

test('P03 Message opens the conversation with the organisation', async ({ page }) => {
  await signInAsNewContributor(page)
  const org = await seedPublicOrg()

  await page.goto(orgPath(org.id))
  await page.getByRole('button', { name: 'Message', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/messages/org/${org.id}`))
  await expect(page.getByLabel(/^Message /)).toBeVisible()
})

test('P05 Ask them to print carries the organisation into the printer search and on to the guide library', async ({ page }) => {
  await signInAsNewContributor(page)
  const org = await seedPublicOrg()

  await page.goto(orgPath(org.id))
  await expect(page.getByText('They print — you cover the filament')).toBeVisible()
  await expect(page.getByText('We cover the filament for the first print.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Ask them to print', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/printing\\?printWith=${org.id}$`))

  // With no guide chosen yet the search offers one, and keeps the organisation.
  await page.getByRole('button', { name: 'Find a guide', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/guides\\?printWith=${org.id}$`))
})

test('P06 Book a drop-off opens the recycling screen', async ({ page }) => {
  await signInAsNewContributor(page)
  const org = await seedPublicOrg()

  await page.goto(orgPath(org.id))
  await expect(page.getByText('They take waste plastic')).toBeVisible()
  await page.getByRole('button', { name: 'Book a drop-off', exact: true }).click()
  await expect(page).toHaveURL(/\/explore\/recycling$/)
  await expect(page.getByText('Diverted from landfill')).toBeVisible()
})

test('P07 each door row goes where its target says, and a door with no screen is not a button', async ({ page }) => {
  await signInAsNewContributor(page)
  const org = await seedPublicOrg({
    doors: [
      { title: 'Browse our shelf', body: 'Toys to take home.', target: 'toy_library' },
      { title: 'Bring us plastic', body: 'Clean and sorted.', target: 'dropoff' },
      { title: 'Print your parts', body: 'We run the machines.', target: 'print' },
      { title: 'Ask us to build', body: 'From a guide.', target: 'build' },
      { title: 'Write to us', body: 'Any question.', target: 'message' },
      { title: 'Come to a build day', body: 'Dates are on the web.', target: 'events' },
    ],
  })
  const expected: [string, RegExp][] = [
    ['Browse our shelf', /\/toy-library$/],
    ['Bring us plastic', /\/explore\/recycling$/],
    ['Print your parts', /\/printing$/],
    ['Ask us to build', /\/explore\/makers-wanted\/new$/],
    ['Write to us', new RegExp(`/messages/org/${org.id}`)],
  ]

  await page.goto(orgPath(org.id))
  await expect(page.getByText('6 doors. None need a referral.')).toBeVisible()
  // Events have no phone screen: the card reads, but is not a button.
  await expect(page.getByText('Come to a build day', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Come to a build day', exact: true })).toHaveCount(0)

  for (const [title, url] of expected) {
    await page.goto(orgPath(org.id))
    await page.getByRole('button', { name: title, exact: true }).click()
    await expect(page).toHaveURL(url)
  }
})

test('P09 Report on an organisation page files an organisation report', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const org = await seedPublicOrg()

  await page.goto(orgPath(org.id))
  await page.getByRole('button', { name: /Report a problem$/ }).click()
  await expect(page.getByText(`About ${org.name} profile.`, { exact: false })).toBeVisible()
  const body = `Wrong opening hours ${Date.now()}`
  const rows = await sendReport(page, me.id, 'Wrong or missing info', body)

  expect(rows).toEqual([
    { subject_kind: 'organisation', subject_id: org.id, subject_label: org.name, category: 'wrong_info', body, status: 'new' },
  ])
})

test('Y09 the Organisations list shows active organisations only, and a row opens its page', async ({ page }) => {
  await signInAsNewContributor(page)
  // The list is name-ordered with no search and only its first screenful is
  // rendered, so these names sort ahead of every other fixture's.
  const active = await seedPublicOrg({ name: uniqueTitle('AAA Listed Org') })
  const suspended = await seedPublicOrg({ name: uniqueTitle('AAA Suspended Org') })
  await adminClient().from('organizations').update({ status: 'suspended' }).eq('id', suspended.id)

  await page.goto('/toy-library/organisations')
  await expect(page.getByRole('button', { name: active.name, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: suspended.name, exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: active.name, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/organisation/${active.id}$`))
  await expect(page.getByRole('heading', { name: active.name })).toBeVisible()
})
