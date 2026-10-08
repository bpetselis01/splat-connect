// journeys: Q03 Q04 Q08 Q09 Q11 Q12 Q16
import { test, expect, type Page } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signIn, signInAsNewContributor, uniqueTitle } from './helpers'
import { seedCollaboratorInvite, seedMapOrg, seedMoneyThread } from './family-fixtures'

// The Me tab (money line, badge rules), the inbox's collaborator invite
// buttons, the Map's list view, and the About links. Each test seeds its own
// rows and asserts only on them.

test.describe('money line on Me opens its own thread', () => {
  const cases = [
    { type: 'donation', path: (id: string) => `/exchanges/${id}` },
    { type: 'build', path: (id: string) => `/exchanges/build/${id}` },
    { type: 'print', path: (id: string) => `/printing/jobs/${id}` },
  ] as const
  for (const c of cases) {
    test(`a ${c.type} line goes to ${c.type === 'donation' ? 'the exchange' : c.type === 'build' ? 'the build thread' : 'the print job'}`, async ({ page }) => {
      const what = `E2E Cost ${c.type} ${Date.now()}`
      const thread = await seedMoneyThread(c.type, what)
      await signIn(page, thread.payer.email, thread.payer.password)
      await page.waitForURL(/\/home$/)

      await page.goto('/me')
      const line = page.getByRole('button', { name: new RegExp(`^${what},`) })
      await expect(line).toHaveAccessibleName(/\$4\.50, to settle$/)
      await line.click()
      await expect(page).toHaveURL(new RegExp(`${c.path(thread.id)}$`))
    })
  }
})

test('How badges are earned opens the rules and closes again', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/me')
  const row = page.getByRole('button', { name: 'How badges are earned', exact: true })
  await expect(page.getByText('Publish your first approved guide.')).toHaveCount(0)
  await row.click()
  await expect(page.getByText('Publish your first approved guide.')).toBeVisible()
  await expect(page.getByText('Awarded for each full year since you joined.')).toBeVisible()
  await row.click()
  await expect(page.getByText('Publish your first approved guide.')).toHaveCount(0)
})

async function inviteFixture() {
  const author = await createContributor()
  const title = uniqueTitle('E2E Invite Guide')
  const tutorialId = await createTutorial(author.id, { title })
  return { author, title, tutorialId }
}

test('Accept on a collaborator invite gives the seat and tells the author', async ({ page }) => {
  const { author, title, tutorialId } = await inviteFixture()
  const invitee = await signInAsNewContributor(page)
  const inviteId = await seedCollaboratorInvite(tutorialId, title, invitee.id, author.id)

  await page.goto('/inbox')
  const accepted = page.waitForResponse((r) => r.url().includes(`/api/collaborators/invites/${inviteId}/accept`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  expect((await accepted).ok()).toBe(true)
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0)

  const admin = adminClient()
  const { data: invite } = await admin.from('tutorial_collaborator_invites').select('status').eq('id', inviteId).single()
  expect(invite?.status).toBe('accepted')
  const { data: seat } = await admin.from('tutorial_contributors').select('role').eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
  expect(seat).toEqual([{ role: 'collaborator' }])
  const { data: told } = await admin.from('notifications').select('type').eq('recipient_id', author.id).eq('tutorial_id', tutorialId)
  expect(told?.map((n) => n.type)).toContain('collaborator_accepted')
})

test('Decline on a collaborator invite leaves no seat and tells the author', async ({ page }) => {
  const { author, title, tutorialId } = await inviteFixture()
  const invitee = await signInAsNewContributor(page)
  const inviteId = await seedCollaboratorInvite(tutorialId, title, invitee.id, author.id)

  await page.goto('/inbox')
  const declined = page.waitForResponse((r) => r.url().includes(`/api/collaborators/invites/${inviteId}/decline`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Decline', exact: true }).click()
  expect((await declined).ok()).toBe(true)
  await expect(page.getByRole('button', { name: 'Decline', exact: true })).toHaveCount(0)

  const admin = adminClient()
  const { data: invite } = await admin.from('tutorial_collaborator_invites').select('status').eq('id', inviteId).single()
  expect(invite?.status).toBe('declined')
  const { data: seat } = await admin.from('tutorial_contributors').select('role').eq('tutorial_id', tutorialId).eq('profile_id', invitee.id)
  expect(seat).toEqual([])
  const { data: told } = await admin.from('notifications').select('type').eq('recipient_id', author.id).eq('tutorial_id', tutorialId)
  expect(told?.map((n) => n.type)).toContain('collaborator_declined')
})

const placeRow = (page: Page, org: string, kind: string) => page.getByRole('button', { name: new RegExp(`^${org}, ${kind}`) })

test('the Map lists a seeded organisation and its drop-off, narrowed by search, layer chip and filament filter', async ({ page }) => {
  await signInAsNewContributor(page)
  const name = uniqueTitle('E2E Map Org')
  const orgId = await seedMapOrg(name)

  await page.goto('/map')
  await page.getByRole('button', { name: /List$/ }).click()
  await page.getByLabel('Search suburbs and places').fill(name)
  await expect(placeRow(page, name, 'Organisation')).toBeVisible()
  await expect(placeRow(page, name, 'Drop-off')).toBeVisible()

  // A layer chip: only organisations remain.
  await page.getByRole('button', { name: 'Organisations', exact: true }).filter({ visible: true }).click()
  await expect(placeRow(page, name, 'Organisation')).toBeVisible()
  await expect(placeRow(page, name, 'Drop-off')).toHaveCount(0)
  await page.getByRole('button', { name: 'Organisations', exact: true }).filter({ visible: true }).click()
  await expect(placeRow(page, name, 'Drop-off')).toBeVisible()

  // The filament filter: this drop-off takes TPU only, so PETG hides it and keeps the organisation.
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByRole('button', { name: 'PETG', exact: true }).click()
  await page.getByRole('button', { name: 'Show places', exact: true }).click()
  await expect(placeRow(page, name, 'Organisation')).toBeVisible()
  await expect(placeRow(page, name, 'Drop-off')).toHaveCount(0)

  // Q12: a row opens its own route.
  await placeRow(page, name, 'Organisation').click()
  await expect(page).toHaveURL(new RegExp(`/toy-library/organisation/${orgId}$`))
})

test('a map drop-off row opens the recycling screen', async ({ page }) => {
  await signInAsNewContributor(page)
  const name = uniqueTitle('E2E Map Dropoff')
  await seedMapOrg(name)

  await page.goto('/map')
  await page.getByRole('button', { name: /List$/ }).click()
  await page.getByLabel('Search suburbs and places').fill(name)
  await placeRow(page, name, 'Drop-off').click()
  await expect(page).toHaveURL(/\/explore\/recycling$/)
})

test('About SPLAT links open the matching web pages', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/explore/about')
  await page.evaluate(() => {
    const w = window as unknown as { opened: string[] }
    w.opened = []
    window.open = (u?: string | URL) => (w.opened.push(String(u)), null)
  })
  const opened = () => page.evaluate(() => (window as unknown as { opened: string[] }).opened)
  for (const [label, path] of [
    ['Safety', '/safety'],
    ['Impact', '/impact'],
    ['Families', '/get-involved/families'],
    ['Support SPLAT', '/about/support'],
  ] as const) {
    await page.getByRole('link', { name: label, exact: true }).click()
    expect((await opened()).at(-1)).toMatch(new RegExp(`${path}$`))
  }
})
