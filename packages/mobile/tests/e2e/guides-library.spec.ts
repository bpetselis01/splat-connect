// journeys: G01 G02 G06
import { test, expect } from '@playwright/test'
import { signInAsNewContributor, createTutorial, uniqueTitle, pickFilter, adminClient } from './helpers'

test('the library lists a tutorial with its difficulty badge', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Library')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/guides')

  await expect(page.getByText(title)).toBeVisible()
  // Scoped to this row: dozens of other workers' rows carry the same word.
  await expect(page.getByRole('button', { name: title }).getByText('Easy', { exact: true })).toBeVisible()
})

test('search narrows the list and clearing it restores the tutorial', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Search')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/guides')

  await page.getByPlaceholder('Search guides').fill('no such toy')
  await expect(page.getByText(title)).toHaveCount(0)

  await page.getByPlaceholder('Search guides').fill('')
  await expect(page.getByText(title)).toBeVisible()
})

test('the difficulty filter narrows results', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Filter')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/guides')

  await pickFilter(page, 'Medium')
  await expect(page.getByText(title)).toHaveCount(0)

  await pickFilter(page, 'Easy')
  await expect(page.getByText(title)).toBeVisible()
})

test('an aborted tutorials request shows the error state and a retry button', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.route('**/api/public/tutorials*', (route) => route.abort())

  await page.goto('/guides')

  await expect(page.getByText("Couldn't load tutorials.")).toBeVisible()
  // WHY: 6bb6a7b dropped the "Pull to retry." copy this spec used to assert —
  //      the error state is a static view with no pull-to-refresh, so the words
  //      promised an interaction that did not exist. That commit updated the
  //      component and its unit test but not this spec, and CI has failed since.
  // HOW:  assert the retry BUTTON, not just the message. Asserting the title
  //       alone would still pass if the button disappeared, which is the whole
  //       affordance the copy was replaced with.
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('a search with no matches shows the empty state', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile Empty'), status: 'approved' })

  await page.goto('/guides')
  await page.getByPlaceholder('Search guides').fill('zzz-no-such-toy-zzz')

  await expect(page.getByText('zzz-no-such-toy-zzz')).toBeVisible()
  await expect(page.locator('text=/No tutorials/i').first()).toBeVisible()
})

test('the skeleton renders while the tutorial request is in flight', async ({ page }) => {
  // Delayed rather than raced: the loading state is otherwise gone before an
  // assertion can reach it. If this ever proves flaky, delete it rather than
  // retry it — a skeleton regression is cosmetic and a flaky test gating main
  // costs more than the bug it catches.
  await signInAsNewContributor(page)
  await page.route('**/api/public/tutorials*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await route.continue()
  })

  await page.goto('/guides')

  await expect(page.getByTestId('skeleton-row').first()).toBeVisible()
})

test('a backed guide carries a Backed pill on the card, and an unbacked one does not', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Backed')
  const org = uniqueTitle('E2E Backing Org')
  await createTutorial(contributor.id, { title, status: 'approved', backedByOrg: org })
  // Its own unbacked guide, not another worker's: the default line has to be
  // asserted against a row this test controls, or the assertion passes on
  // whatever else happens to be in the library.
  const plain = uniqueTitle('E2E Mobile Unbacked Card')
  await createTutorial(contributor.id, { title: plain, status: 'approved' })

  await page.goto('/guides')

  await page.getByPlaceholder('Search guides').fill(title)
  await expect(page.getByRole('button', { name: title }).getByText('Backed', { exact: true })).toBeVisible()

  // The unbacked card has no pill; its row still tells a screen reader who
  // reviewed it.
  await page.getByPlaceholder('Search guides').fill(plain)
  await expect(page.getByRole('button', { name: plain })).toBeVisible()
  await expect(page.getByRole('button', { name: plain }).getByText('Backed', { exact: true })).toHaveCount(0)
})

test('tapping Save on a card flips the bookmark and the flip survives a reload', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Save')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/guides')
  // Narrowed to the one row first: every card carries its own bookmark, and
  // the button has no per-row name to tell them apart by.
  await page.getByPlaceholder('Search guides').fill(title)
  await expect(page.getByText(title)).toBeVisible()

  // Awaited, not just clicked: the flip is optimistic, so a reload fired
  // straight after the click aborts the POST in flight and the save never
  // reaches the database — which is exactly what this spec would then miss.
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/saves') && r.request().method() === 'POST'
  )
  await page.getByLabel('Save', { exact: true }).click()
  await expect(page.getByLabel('Saved', { exact: true })).toBeVisible()
  expect((await saved).status()).toBe(201)

  // The reload is the point: only a fresh /api/saves/ids proves the row is
  // really there, rather than the optimistic flip still showing.
  await page.reload()
  await page.getByPlaceholder('Search guides').fill(title)
  await expect(page.getByLabel('Saved', { exact: true })).toBeVisible()
})

test('the filter page narrows to guides tagged for the child, and removing a tag widens it again', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const prefix = uniqueTitle('E2E Mobile Suits')
  const [fits, other] = await Promise.all(
    ['Fits', 'Other', 'Untagged'].map((n) => createTutorial(contributor.id, { title: `${prefix} ${n}`, status: 'approved' }))
  )
  const admin = adminClient()
  await admin.from('tutorials').update({ device_types: ['communication'], access: ['eyes'], play: ['light', 'sound'] }).eq('id', fits)
  await admin.from('tutorials').update({ device_types: ['switch'], access: ['press'], play: ['light'] }).eq('id', other)

  await page.goto('/guides')
  await page.getByPlaceholder('Search guides').fill(prefix)
  await expect(page.getByText(`${prefix} Untagged`)).toBeVisible()

  // Within a question any answer matches; across questions all must. An untagged guide never matches a filtered question.
  await pickFilter(page, 'Eyes', 'Lights')
  await expect(page.getByText(`${prefix} Fits`)).toBeVisible()
  await expect(page.getByText(`${prefix} Other`)).toHaveCount(0)
  await expect(page.getByText(`${prefix} Untagged`)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Filters, 2 on' })).toBeVisible()

  await page.getByRole('button', { name: 'Remove filter: Eyes' }).click()
  await expect(page.getByText(`${prefix} Other`)).toBeVisible()
  await expect(page.getByText(`${prefix} Untagged`)).toHaveCount(0)

  await pickFilter(page, 'Switch')
  await expect(page.getByText(`${prefix} Other`)).toBeVisible()
  await expect(page.getByText(`${prefix} Fits`)).toHaveCount(0)
})

test('Recommended puts the guides that share the child\'s answers first, then newest', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const prefix = uniqueTitle('E2E Mobile Recommended')
  const admin = adminClient()
  // Created oldest first, so newest-first alone would put Plain on top.
  const match = await createTutorial(contributor.id, { title: `${prefix} Match`, status: 'approved' })
  await createTutorial(contributor.id, { title: `${prefix} Plain`, status: 'approved' })
  await admin.from('tutorials').update({ helps_with: ['hearing'], play: ['sound'] }).eq('id', match)
  await admin.from('child_profiles').insert({ parent_id: contributor.id, name: 'Iris', helps_with: ['hearing'], enjoys: ['sound'] })

  await page.goto('/guides')
  await page.getByPlaceholder('Search guides').fill(prefix)
  const rows = page.getByRole('button', { name: new RegExp(`^${prefix}`) })
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toHaveAccessibleName(new RegExp(`${prefix} Match`))
})
