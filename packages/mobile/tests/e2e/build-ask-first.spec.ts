import { test, expect } from '@playwright/test'
import { adminClient } from './helpers'
import { notificationsFor, partyPage, seedBuild, sent, txRow } from './maker-fixtures'

/**
 * Ask first, both sides: a maker opens it from the board and asks, the family
 * reads the question and answers, then the maker claims from the same screen
 * and lands in the build thread with the questions carried over.
 */
test('K03 K04 a maker asks first, the family answers, and the maker then claims from the same screen', async ({ browser, baseURL }) => {
  const build = await seedBuild()
  const makerPage = await partyPage(browser, baseURL, build.maker)
  const familyPage = await partyPage(browser, baseURL, build.requester)

  try {
    // K03: from the board's "Ask first" on this request's own card.
    await makerPage.goto('/explore/makers-wanted')
    await expect(makerPage.getByText(build.title)).toBeVisible()
    await makerPage
      .locator('div')
      .filter({ hasText: build.title })
      .filter({ has: makerPage.getByRole('button', { name: 'Ask first' }) })
      .last()
      .getByRole('button', { name: 'Ask first' })
      .click()
    await expect(makerPage).toHaveURL(new RegExp(`/exchanges/build/ask/${build.id}$`))

    const question = `Is PETG fine for the case ${Date.now()}`
    await makerPage.getByLabel('Message', { exact: true }).fill(question)
    await sent(makerPage, '/questions', () => makerPage.getByRole('button', { name: 'Send', exact: true }).click())
    await expect(makerPage.getByText(question)).toBeVisible()

    const { data: asked } = await adminClient()
      .from('build_request_questions')
      .select('maker_id, sender_id')
      .eq('transaction_id', build.id)
      .eq('body', question)
    expect(asked).toEqual([{ maker_id: build.maker.id, sender_id: build.maker.id }])
    expect(await notificationsFor(build.requester.id, 'build_question', build.id)).toHaveLength(1)

    // The family's side: the question is in the maker's thread, and they answer it.
    await familyPage.goto(`/exchanges/build/ask/${build.id}`)
    await expect(familyPage.getByText(question)).toBeVisible()
    const answer = `Yes, PETG is great ${Date.now()}`
    await familyPage.getByLabel('Message', { exact: true }).fill(answer)
    await sent(familyPage, '/questions', () => familyPage.getByRole('button', { name: 'Send', exact: true }).click())
    await expect(familyPage.getByText(answer)).toBeVisible()
    expect(await notificationsFor(build.maker.id, 'build_question', build.id)).toHaveLength(1)

    await makerPage.goto(`/exchanges/build/ask/${build.id}`)
    await expect(makerPage.getByText(answer)).toBeVisible()

    // K04: claiming from Ask first moves the thread into the build.
    await makerPage.getByRole('button', { name: "I'll build this" }).click()
    await expect(makerPage).toHaveURL(new RegExp(`/exchanges/build/${build.id}$`))
    expect(await txRow(build.id)).toMatchObject({ status: 'accepted', owner_id: build.maker.id })
    expect(await notificationsFor(build.requester.id, 'toy_accepted', build.id)).toHaveLength(1)
    await expect(makerPage.getByText(question)).toBeVisible()
    await expect(makerPage.getByText(answer)).toBeVisible()

    await familyPage.goto(`/exchanges/build/${build.id}`)
    await expect(familyPage.getByText(`${build.makerName} claimed this build.`)).toBeVisible()
  } finally {
    await makerPage.context().close()
    await familyPage.context().close()
  }
})
