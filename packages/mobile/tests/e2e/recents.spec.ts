// journeys: H06
import { test, expect, type Page } from '@playwright/test'
import { createTutorial, signInAsNewContributor, signIn, uniqueTitle } from './helpers'

/**
 * "Pick up where you left off" follows what this member opened last: newest
 * first, a re-open moves to the top without a second row, at most ten rows,
 * and one list per account (lib/recents.ts).
 */

const SECTION = 'Pick up where you left off'

/** Opens a guide and waits for it to load, which is when it is recorded. */
async function openGuide(page: Page, id: string) {
  await page.goto(`/guides/${id}`)
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
}

/** The recents rows on Home whose titles start with `prefix`, top to bottom. */
async function recentTitles(page: Page, prefix: string): Promise<string[]> {
  await page.goto('/home')
  await expect(page.getByText(SECTION)).toBeVisible()
  const names = await page.getByRole('button', { name: new RegExp(`^${prefix}`) }).evaluateAll((els) =>
    els.map((el) => el.getAttribute('aria-label') ?? el.textContent ?? '')
  )
  return names.map((n) => n.match(new RegExp(`${prefix} \\d+`))?.[0] ?? n)
}

/** Drops the Supabase session only, so the next sign-in is another member on the same device. */
async function signOutKeepingDeviceData(page: Page) {
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('sb-')) localStorage.removeItem(k)
  })
}

test('newest first, and re-opening something moves it to the top without a second row', async ({ page }) => {
  const member = await signInAsNewContributor(page)
  const prefix = uniqueTitle('E2E Recent Order')
  const [a, b, c] = await Promise.all([1, 2, 3].map((n) => createTutorial(member.id, { title: `${prefix} ${n}`, status: 'approved' })))

  await openGuide(page, a)
  await openGuide(page, b)
  await openGuide(page, c)
  expect(await recentTitles(page, prefix)).toEqual([`${prefix} 3`, `${prefix} 2`, `${prefix} 1`])

  await openGuide(page, a)
  expect(await recentTitles(page, prefix)).toEqual([`${prefix} 1`, `${prefix} 3`, `${prefix} 2`])
})

test('at most ten rows: the eleventh opened pushes the oldest out', async ({ page }) => {
  test.setTimeout(120_000)
  const member = await signInAsNewContributor(page)
  const prefix = uniqueTitle('E2E Recent Cap')
  const ids = await Promise.all(Array.from({ length: 11 }, (_, i) => createTutorial(member.id, { title: `${prefix} ${i + 1}`, status: 'approved' })))

  for (const id of ids) await openGuide(page, id)

  const titles = await recentTitles(page, prefix)
  expect(titles).toHaveLength(10)
  expect(titles[0]).toBe(`${prefix} 11`)
  expect(titles).not.toContain(`${prefix} 1`)

  // The device holds ten too, not just the screen.
  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('home-recents.'))
      .map((k) => JSON.parse(localStorage.getItem(k) as string).length)
  )
  expect(stored).toEqual([10])
})

test('each account on the device keeps its own list', async ({ page }) => {
  const first = await signInAsNewContributor(page)
  const prefix = uniqueTitle('E2E Recent Owner')
  const mine = await createTutorial(first.id, { title: `${prefix} 1`, status: 'approved' })
  await openGuide(page, mine)
  expect(await recentTitles(page, prefix)).toEqual([`${prefix} 1`])

  await signOutKeepingDeviceData(page)
  const second = await signInAsNewContributor(page)
  await page.goto('/home')
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
  await expect(page.getByText(SECTION)).toBeHidden()

  const theirs = await createTutorial(second.id, { title: `${prefix} 2`, status: 'approved' })
  await openGuide(page, theirs)
  expect(await recentTitles(page, prefix)).toEqual([`${prefix} 2`])

  await signOutKeepingDeviceData(page)
  await signIn(page, first.email, first.password)
  await expect(page).toHaveURL(/\/home$/)
  expect(await recentTitles(page, prefix)).toEqual([`${prefix} 1`])
})
