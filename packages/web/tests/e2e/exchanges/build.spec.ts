import path from 'node:path'
import { test, expect } from '@playwright/test'
import { adminClient, createTutorial, deleteUser, uniqueTitle } from '../helpers'
import { fillPickup, inboxRow, myCode, openExchangesList, seat, unreadIs, type Seat } from './support'

const PHOTO = path.join(__dirname, '..', 'fixtures', 'test.jpg')

/** A build the family has asked a named maker for: the state a directed ask leaves behind. */
async function askedMaker(family: Seat, maker: Seat, tutorialId: string) {
  const { data, error } = await adminClient()
    .from('toy_transactions')
    .insert({
      type: 'build', status: 'requested', tutorial_id: tutorialId, requester_id: family.id, owner_id: maker.id,
      build_brief: 'For Leo, 3. He uses a 100 mm button switch.',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return `/dashboard/exchanges/build/${data!.id}`
}

test('WX15 WX16 WX19 WX20 WX21 WX23 WX01 a Build runs ask, accept, working shot, approval, message, confirm and closed across two seats', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  const maker = await seat(browser, baseURL, 'Tom Maker')
  const family = await seat(browser, baseURL, 'Fiona Family')
  const title = uniqueTitle('Bubble machine')
  const tutorialId = await createTutorial(maker.id, { title, status: 'approved' })
  const thread = await askedMaker(family, maker, tutorialId)
  try {
    // Ask: the maker has a request to take on
    await maker.page.goto(thread)
    await expect(maker.page.getByRole('heading', { name: 'Fiona Family is asking for a build' })).toBeVisible()
    await expect(maker.page.getByRole('complementary').getByText('Take it on, or decline')).toBeVisible()
    await expect(maker.page.getByText('Waiting for a maker').first()).toBeVisible()
    await maker.page.getByRole('link', { name: /Open the guide/ }).click()
    await expect(maker.page).toHaveURL(new RegExp(`/tutorials/${tutorialId}$`))

    // Accept
    await maker.page.goto(thread)
    await maker.page.getByRole('button', { name: 'Accept', exact: true }).click()
    await fillPickup(maker.page, '3 Maker St')
    await maker.page.getByRole('button', { name: 'Accept request' }).click()
    await expect(maker.page.getByRole('complementary').getByText('Build it, then post a working shot')).toBeVisible()
    await expect(maker.page.getByText('The maker posts a photo')).toBeVisible()
    await unreadIs(family.page, 1)
    await inboxRow(family.page, `Tom Maker accepted your request for ${title}`)
    await openExchangesList(family.page)
    await unreadIs(family.page, 0)

    // Working shot
    await family.page.goto(thread)
    await expect(family.page.getByRole('complementary').getByText('They are building it')).toBeVisible()
    await maker.page.goto(thread)
    await maker.page.getByLabel('Working shot').setInputFiles(PHOTO)
    await expect(maker.page.getByRole('complementary').getByText('Waiting for them to approve')).toBeVisible()
    await expect(maker.page.getByText('Waiting on the family')).toBeVisible()
    await unreadIs(family.page, 1)
    await inboxRow(family.page, new RegExp(`Tom Maker posted a photo of ${title} working`))
    await family.page.goto(thread)
    await expect(family.page.getByRole('complementary').getByText('Check the working shot')).toBeVisible()
    await openExchangesList(family.page)
    await unreadIs(family.page, 0)

    // Approval unlocks the handover
    await family.page.goto(thread)
    await family.page.getByRole('button', { name: 'Looks right — arrange the handover' }).click()
    await expect(family.page.getByRole('complementary').getByText('Arrange the handover')).toBeVisible()
    await expect(family.page.getByText('Agree a time').first()).toBeVisible()
    await unreadIs(maker.page, 1)
    await inboxRow(maker.page, `Fiona Family approved the working shot for ${title}`)
    await openExchangesList(maker.page)
    await unreadIs(maker.page, 0)

    // Message
    await maker.page.goto(thread)
    await maker.page.getByLabel(/^Message /).fill('Friday after three suits me.')
    await maker.page.getByRole('button', { name: 'Send' }).click()
    await expect(maker.page.getByRole('log', { name: 'Conversation' })).toContainText('Friday after three suits me.')
    await unreadIs(family.page, 1)
    await inboxRow(family.page, /Tom Maker sent a message about/)
    await openExchangesList(family.page)
    await unreadIs(family.page, 0)

    // Confirm on both sides, then closed
    await family.page.goto(thread)
    const familyCode = await myCode(family.page)
    await maker.page.goto(thread)
    const makerCode = await myCode(maker.page)
    await maker.page.getByLabel(/Enter the other party/).fill(familyCode)
    await maker.page.getByRole('button', { name: 'Confirm handoff' }).click()
    await expect(maker.page.getByText(/You have confirmed the handoff/)).toBeVisible()
    await family.page.goto(thread)
    await family.page.getByLabel(/Enter the other party/).fill(makerCode)
    await family.page.getByRole('button', { name: 'Confirm handoff' }).click()
    await expect(family.page.getByText('Handoff complete.')).toBeVisible()
    await expect(family.page.getByRole('complementary').getByText('Both of you confirmed')).toBeVisible()
    await expect(family.page.getByText('Tom Maker built this for you')).toBeVisible()
    await expect(family.page.getByText('The family said yes')).toBeVisible()
  } finally {
    await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
    await adminClient().from('tutorials').delete().eq('id', tutorialId)
    await deleteUser(maker.id)
    await deleteUser(family.id)
  }
})

test('WX22 WX24 WX25 an open Build request is asked about first, then claimed by a maker', async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  const maker = await seat(browser, baseURL, 'Tom Maker')
  const family = await seat(browser, baseURL, 'Fiona Family')
  const title = uniqueTitle('Open bubble machine')
  const tutorialId = await createTutorial(maker.id, { title, status: 'approved' })
  try {
    // Ask openly, from the guide
    await family.page.goto(`/get-involved/makers-wanted/new?guide=${tutorialId}`)
    await family.page.getByLabel(/Your suburb/).fill('Ashfield')
    await family.page.getByRole('checkbox', { name: /You cover the toy and parts/ }).check()
    await family.page.getByRole('button', { name: 'Post to Makers wanted' }).click()
    await family.page.waitForURL(/\/dashboard\/exchanges\/build\/[0-9a-f-]{36}$/)
    const thread = family.page.url()
    const id = thread.split('/').pop()
    await expect(family.page.getByText('Waiting for a maker to claim it', { exact: true })).toBeVisible()
    await expect(family.page.getByText('Waiting for a maker', { exact: true }).first()).toBeVisible()

    // The family can see the questions page; the maker asks
    await family.page.getByRole('link', { name: 'Asking first' }).click()
    await expect(family.page).toHaveURL(`${thread}/ask`)
    await maker.page.goto(`/dashboard/exchanges/build/${id}/ask`)
    await expect(maker.page.getByText('Not claimed yet')).toBeVisible()
    await maker.page.getByRole('textbox', { name: 'Message' }).fill('Does the switch need a 3.5 mm jack?')
    await maker.page.getByRole('button', { name: 'Send' }).click()
    await expect(maker.page.getByText('Does the switch need a 3.5 mm jack?')).toBeVisible()

    await unreadIs(family.page, 1)
    await inboxRow(family.page, /Tom Maker wrote about .* before anyone claimed it/)
    await family.page.getByRole('button', { name: /Tom Maker wrote about/ }).click()
    await expect(family.page).toHaveURL(new RegExp(`/dashboard/exchanges/build/${id}/ask`))
    await openExchangesList(family.page)
    await unreadIs(family.page, 0)

    // The family answers that maker
    await family.page.goto(`${thread}/ask?maker=${maker.id}`)
    await family.page.getByRole('textbox', { name: 'Message' }).fill('Yes, a standard 3.5 mm jack.')
    await family.page.getByRole('button', { name: 'Send' }).click()
    await expect(family.page.getByText('Yes, a standard 3.5 mm jack.')).toBeVisible()
    await unreadIs(maker.page, 1)

    // Claim
    await maker.page.goto(`/dashboard/exchanges/build/${id}/ask`)
    await maker.page.getByRole('button', { name: /I.ll build this/ }).click()
    await expect(maker.page).toHaveURL(thread)
    await expect(maker.page.getByRole('complementary').getByText('Build it, then post a working shot')).toBeVisible()
    await expect(family.page.getByRole('link', { name: 'Asking first' })).toHaveCount(0)
    await unreadIs(family.page, 1)
    await inboxRow(family.page, `Tom Maker accepted your request for ${title}`)
  } finally {
    await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
    await adminClient().from('tutorials').delete().eq('id', tutorialId)
    await deleteUser(maker.id)
    await deleteUser(family.id)
  }
})

test('WX17 WX18 a maker can decline a Build request, and the family can withdraw one', async ({ browser, baseURL }) => {
  test.setTimeout(120_000)
  const maker = await seat(browser, baseURL, 'Tom Maker')
  const family = await seat(browser, baseURL, 'Fiona Family')
  const title = uniqueTitle('Declined bubble machine')
  const tutorialId = await createTutorial(maker.id, { title, status: 'approved' })
  try {
    const declined = await askedMaker(family, maker, tutorialId)
    await maker.page.goto(declined)
    await maker.page.getByRole('button', { name: 'Reject' }).click()
    await expect(maker.page.getByText('This request was declined.')).toBeVisible()
    await expect(maker.page.getByText('Nobody took it on')).toBeVisible()
    await unreadIs(family.page, 1)
    await inboxRow(family.page, `Tom Maker declined your request for ${title}`)

    const withdrawn = await askedMaker(family, maker, tutorialId)
    await family.page.goto(withdrawn)
    await family.page.getByRole('button', { name: 'Withdraw the request' }).click()
    await expect(family.page.getByText('This request was withdrawn.')).toBeVisible()
    await unreadIs(maker.page, 1)
    await inboxRow(maker.page, `Fiona Family withdrew their request for ${title}`)
  } finally {
    await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
    await adminClient().from('tutorials').delete().eq('id', tutorialId)
    await deleteUser(maker.id)
    await deleteUser(family.id)
  }
})
