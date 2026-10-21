import { expect, type Browser, type Page } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, signIn } from '../helpers'

export type Seat = Awaited<ReturnType<typeof createContributor>> & { page: Page }

/** A contributor with their own name and browser context, signed in and past the terms gate. */
export async function seat(browser: Browser, baseURL: string | undefined, name: string): Promise<Seat> {
  const user = await createContributor()
  await acceptTerms(user.id)
  await adminClient().from('profiles').update({ name }).eq('id', user.id)
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signIn(page, user.email, user.password)
  return { ...user, name, page }
}

/** The header badge on the account link: the viewer's unread total, 0 when it is not drawn. */
export async function unread(page: Page): Promise<number> {
  await page.goto('/dashboard')
  const badge = page.locator('.nav-account__badge')
  return (await badge.count()) ? Number(await badge.textContent()) : 0
}

export const unreadIs = (page: Page, n: number) => expect.poll(() => unread(page)).toBe(n)

/** One inbox row, by its sentence. */
export async function inboxRow(page: Page, sentence: string | RegExp) {
  await page.goto('/notifications')
  await expect(page.getByRole('button', { name: sentence })).toBeVisible()
}

/** Opening My exchanges is what clears the bucket on web. */
export async function openExchangesList(page: Page) {
  await page.goto('/dashboard/exchanges')
  await expect(page.getByRole('heading', { name: 'My exchanges' })).toBeVisible()
}

/** The viewer's own handover code, read from the thread the way the Gift spec does. */
export async function myCode(page: Page): Promise<string> {
  const text = await page.getByText(/your hand(?:off|over) code/i).textContent()
  const code = text?.match(/\d{6}/)?.[0]
  expect(code).toBeTruthy()
  return code!
}

export async function fillPickup(page: Page, line1: string) {
  await page.getByLabel('Street address').fill(line1)
  await page.getByLabel('Suburb').fill('Testville')
  await page.getByLabel('State').fill('VIC')
  await page.getByLabel('Postcode').fill('3000')
}
