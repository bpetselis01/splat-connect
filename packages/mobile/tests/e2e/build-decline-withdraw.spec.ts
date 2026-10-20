import { test, expect } from '@playwright/test'
import { notificationsFor, partyPage, seedBuild, txRow } from './maker-fixtures'

/** The two ways a build ends early: the addressed maker declines, or the family withdraws a live one. */

test('K07 a maker declines a request addressed to them and the family sees it closed', async ({ browser, baseURL }) => {
  const build = await seedBuild({ withMaker: true })
  const makerPage = await partyPage(browser, baseURL, build.maker)
  const familyPage = await partyPage(browser, baseURL, build.requester)

  try {
    await makerPage.goto(`/exchanges/build/${build.id}`)
    await makerPage.getByRole('button', { name: 'Decline' }).click()
    await expect(makerPage.getByText('This one did not go ahead')).toBeVisible()
    expect(await txRow(build.id)).toMatchObject({ status: 'rejected' })
    expect(await notificationsFor(build.requester.id, 'toy_rejected', build.id)).toHaveLength(1)

    await familyPage.goto(`/exchanges/build/${build.id}`)
    await expect(familyPage.getByText('This one did not go ahead')).toBeVisible()
    await expect(familyPage.getByText('Nothing was built').first()).toBeVisible()
  } finally {
    await makerPage.context().close()
    await familyPage.context().close()
  }
})

test('K12 the family withdraws a claimed build and the maker is told', async ({ browser, baseURL }) => {
  const build = await seedBuild({ status: 'accepted' })
  const makerPage = await partyPage(browser, baseURL, build.maker)
  const familyPage = await partyPage(browser, baseURL, build.requester)

  try {
    await familyPage.goto(`/exchanges/build/${build.id}`)
    // Two browser dialogs: "Withdraw this request?" (Proceed), then "Request withdrawn" (OK).
    const dialogs: string[] = []
    familyPage.on('dialog', (d) => {
      dialogs.push(d.message().split('\n')[0])
      void d.accept()
    })
    await familyPage.getByRole('button', { name: 'Withdraw the request' }).click()
    await expect.poll(() => dialogs).toEqual(['Withdraw this request?', 'Request withdrawn'])
    await expect(familyPage.getByText('This request was withdrawn')).toBeVisible()
    expect(await txRow(build.id)).toMatchObject({ status: 'withdrawn' })
    expect(await notificationsFor(build.maker.id, 'toy_withdrawn', build.id)).toHaveLength(1)

    await makerPage.goto(`/exchanges/build/${build.id}`)
    await expect(makerPage.getByText('This request was withdrawn')).toBeVisible()
  } finally {
    await makerPage.context().close()
    await familyPage.context().close()
  }
})
