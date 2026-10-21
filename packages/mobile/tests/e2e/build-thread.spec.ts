import { test, expect } from '@playwright/test'
import { adminClient } from './helpers'
import { PICKUP, notificationsFor, partyPage, seedBuild, sent, txRow } from './maker-fixtures'

/**
 * The build thread after a request reaches a maker: taking on one addressed to
 * them (with a pickup place), then the working shot, a change request, approval
 * and the two-code handover. Two contexts, one per party; each move checks the
 * row, the notification and what the other side's page then shows.
 */

test.setTimeout(180_000)
test('K06 a maker takes on a request addressed to them, giving a pickup place, and the family is told', async ({ browser, baseURL }) => {
  const build = await seedBuild({ withMaker: true })
  const makerPage = await partyPage(browser, baseURL, build.maker)
  const familyPage = await partyPage(browser, baseURL, build.requester)

  try {
    await makerPage.goto(`/exchanges/build/${build.id}`)
    await makerPage.getByRole('button', { name: 'Take it on' }).click()
    // No saved address on a fresh account, so the form comes up empty and gets typed.
    await makerPage.getByLabel('Street address').fill(PICKUP.pickup_line1)
    await makerPage.getByLabel('Suburb').fill(PICKUP.pickup_suburb)
    await makerPage.getByLabel('State').fill(PICKUP.pickup_state)
    await makerPage.getByLabel('Postcode').fill(PICKUP.pickup_postcode)
    await makerPage.getByRole('button', { name: 'Take it on' }).last().click()
    await expect(makerPage.getByText('Build it, then post a working shot')).toBeVisible()

    expect(await txRow(build.id)).toMatchObject({ status: 'accepted', owner_id: build.maker.id, ...PICKUP })
    expect(await notificationsFor(build.requester.id, 'toy_accepted', build.id)).toHaveLength(1)

    await familyPage.goto(`/exchanges/build/${build.id}`)
    await expect(familyPage.getByText(`${build.makerName} is building it`)).toBeVisible()
  } finally {
    await makerPage.context().close().catch(() => {})
    await familyPage.context().close().catch(() => {})
  }
})

test('K08 K09 K10 K11 K13 the working shot, a change request, approval and the handover codes run a build to done', async ({ browser, baseURL }) => {
  const build = await seedBuild({ status: 'accepted' })
  const makerPage = await partyPage(browser, baseURL, build.maker)
  const familyPage = await partyPage(browser, baseURL, build.requester)
  const postShot = async () => {
    const chooser = makerPage.waitForEvent('filechooser', { timeout: 15_000 })
    await makerPage.getByRole('button', { name: /working shot/ }).first().click()
    await (await chooser).setFiles('tests/e2e/fixtures/test.jpg')
  }

  try {
    // K08: the shot goes to the private bucket, the family is told and can see it.
    await makerPage.goto(`/exchanges/build/${build.id}`)
    await postShot()
    await expect(makerPage.getByText('Waiting for the family to approve')).toBeVisible()
    const shot = await txRow(build.id)
    expect(shot.working_photo_url).toContain(build.id)
    expect(shot.work_approved_at).toBeNull()
    expect(await notificationsFor(build.requester.id, 'build_shot_posted', build.id)).toHaveLength(1)
    await familyPage.goto(`/exchanges/build/${build.id}`)
    await expect(familyPage.getByText('Check the working shot')).toBeVisible()
    await expect(familyPage.getByLabel('The working shot')).toBeVisible()

    // K10: "Ask for a change" only starts the sentence; nothing is sent by it.
    await familyPage.getByRole('button', { name: 'Ask for a change' }).click()
    const composer = familyPage.getByLabel('Message', { exact: true })
    await expect(composer).toHaveValue('Could you change ')
    const messages = () => adminClient().from('toy_transaction_messages').select('body').eq('transaction_id', build.id).eq('kind', 'user')
    expect((await messages()).data).toEqual([])

    // K13: the sentence, finished and sent, reaches the maker's thread and inbox.
    await composer.fill('Could you change the lid colour')
    await sent(familyPage, '/messages', () => familyPage.getByRole('button', { name: 'Send', exact: true }).click())
    await expect(familyPage.getByText('Could you change the lid colour')).toBeVisible()
    expect((await messages()).data).toEqual([{ body: 'Could you change the lid colour' }])
    expect(await notificationsFor(build.maker.id, 'toy_message', build.id)).toHaveLength(1)
    await makerPage.goto(`/exchanges/build/${build.id}`)
    await expect(makerPage.getByText('Could you change the lid colour')).toBeVisible()

    // The maker replaces the shot; the family approves it (K09).
    await expect(makerPage.getByRole('button', { name: 'Replace the working shot' }).first()).toBeVisible()
    await postShot()
    await familyPage.goto(`/exchanges/build/${build.id}`)
    await familyPage.getByRole('button', { name: 'Looks right — arrange pickup' }).click()
    await expect(familyPage.getByText('Your handover code')).toBeVisible()
    expect((await txRow(build.id)).work_approved_at).not.toBeNull()
    expect(await notificationsFor(build.maker.id, 'build_approved', build.id)).toHaveLength(1)
    await makerPage.goto(`/exchanges/build/${build.id}`)
    await expect(makerPage.getByText('Your handover code')).toBeVisible()
    await expect(makerPage.getByRole('button', { name: /working shot/ })).toHaveCount(0)

    // K11: each side types the other's code; one confirmation alone does not close it.
    await makerPage.getByLabel('Enter their code').fill('444444')
    await makerPage.getByRole('button', { name: 'Confirm handover' }).click()
    await expect(makerPage.getByText(`Waiting on ${build.requesterName} to confirm`)).toBeVisible()
    expect(await txRow(build.id)).toMatchObject({ status: 'accepted' })
    expect((await txRow(build.id)).owner_confirmed_at).not.toBeNull()

    await familyPage.goto(`/exchanges/build/${build.id}`)
    await familyPage.getByLabel('Enter their code').fill('333333')
    await familyPage.getByRole('button', { name: 'Confirm handover' }).click()
    await expect(familyPage.getByText('Both of you confirmed')).toBeVisible()
    expect((await txRow(build.id)).status).toBe('completed')
    await makerPage.goto(`/exchanges/build/${build.id}`)
    await expect(makerPage.getByText('Both of you confirmed')).toBeVisible()
  } finally {
    await makerPage.context().close().catch(() => {})
    await familyPage.context().close().catch(() => {})
  }
})
