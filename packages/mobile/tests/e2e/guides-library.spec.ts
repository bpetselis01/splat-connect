import { test, expect } from '@playwright/test'
import { signInAsNewContributor, createTutorial, uniqueTitle } from './helpers'

test('the library lists a tutorial with its difficulty badge', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Library')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/guides')

  await expect(page.getByText(title)).toBeVisible()
  // The badge is uppercased in CSS, not in the string, so the text node stays
  // "Easy" — getByText matches textContent, not the rendered transform.
  // .last() because the "Easy" difficulty filter chip renders above the list.
  await expect(page.getByText('Easy', { exact: true }).last()).toBeVisible()
})

test('search narrows the list and clearing it restores the tutorial', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Search')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/guides')

  await page.getByPlaceholder('Search tutorials').fill('no such toy')
  await expect(page.getByText(title)).toHaveCount(0)

  await page.getByPlaceholder('Search tutorials').fill('')
  await expect(page.getByText(title)).toBeVisible()
})

test('the difficulty filter narrows results', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Filter')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/guides')

  await page.getByText('Medium', { exact: true }).click()
  await expect(page.getByText(title)).toHaveCount(0)

  await page.getByText('Easy', { exact: true }).click()
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
  await page.getByPlaceholder('Search tutorials').fill('zzz-no-such-toy-zzz')

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

test('the kind chips narrow the list to one kind, and tapping again clears them', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const toy = uniqueTitle('E2E Mobile Kind Toy')
  const tech = uniqueTitle('E2E Mobile Kind Tech')
  await createTutorial(contributor.id, { title: toy, status: 'approved' })
  await createTutorial(contributor.id, { title: tech, status: 'approved', kind: 'assistive_tech' })

  await page.goto('/guides')
  await expect(page.getByText(toy)).toBeVisible()

  const techChip = page.getByRole('button', { name: 'Assistive tech', exact: true })
  await techChip.click()
  await expect(page.getByText(tech)).toBeVisible()
  await expect(page.getByText(toy)).toHaveCount(0)

  // The kind chips are a toggle, not a radio set — the same chip clears itself.
  await techChip.click()
  await expect(page.getByText(toy)).toBeVisible()
})

test('a backed guide names its organisation on the card', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Backed')
  const org = uniqueTitle('E2E Backing Org')
  await createTutorial(contributor.id, { title, status: 'approved', backedByOrg: org })

  await page.goto('/guides')

  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText(`Backed by ${org}`)).toBeVisible()
  // Every other worker's fixture is unbacked, so the default line is on screen
  // too — this asserts the backed card took the other branch, not that the
  // default one is gone.
  await expect(page.getByText('Reviewed by SPLAT').first()).toBeVisible()
})

test('tapping Save on a card flips the bookmark and the flip survives a reload', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Mobile Save')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/guides')
  // Narrowed to the one row first: every card carries its own bookmark, and
  // the button has no per-row name to tell them apart by.
  await page.getByPlaceholder('Search tutorials').fill(title)
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
  await page.getByPlaceholder('Search tutorials').fill(title)
  await expect(page.getByLabel('Saved', { exact: true })).toBeVisible()
})
