import { expect, type Page } from '@playwright/test'
import { acceptTerms, adminClient, createAdmin, createContributor, signIn } from '../helpers'

type Person = { id: string; email: string; password: string }

/** A fresh admin signed in and standing on /admin. */
export async function signInAdmin(page: Page) {
  const admin = await createAdmin()
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  return admin
}

/** A contributor who has accepted the terms, so signing in lands on /dashboard. */
export async function createMember() {
  const member = await createContributor()
  await acceptTerms(member.id)
  return member
}

/**
 * The number on a /admin queue card. The counts are global and other specs
 * share the database, so callers compare a read before an action with a read
 * after it rather than asserting an absolute.
 */
export async function cardCount(page: Page, card: RegExp): Promise<number> {
  await page.goto('/admin')
  const text = await page.getByRole('link', { name: card }).locator('p').first().innerText()
  return Number(text)
}

type Queue = 'tutorials' | 'reports' | 'ideas' | 'accounts' | 'organisations' | 'orgRequests' | 'inbox' | 'testPrints'

const head = { count: 'exact', head: true } as const

/** The rows a card counts, read straight from the table the API counts. */
const LIVE: Record<Queue, () => PromiseLike<{ count: number | null }>> = {
  tutorials: () => adminClient().from('tutorials').select('id', head).eq('status', 'pending'),
  reports: () => adminClient().from('member_reports').select('id', head).neq('status', 'resolved'),
  ideas: () => adminClient().from('toy_ideas').select('id', head).eq('status', 'pending'),
  accounts: () => adminClient().from('profiles').select('id', head).neq('role', 'admin'),
  organisations: () => adminClient().from('organizations').select('id', head),
  orgRequests: () => adminClient().from('organization_requests').select('id', head).eq('status', 'pending'),
  inbox: () => adminClient().from('contact_messages').select('id', head).eq('status', 'open'),
  testPrints: () => adminClient().from('printer_test_prints').select('id', head).is('verdict', null),
}

export async function liveCount(queue: Queue): Promise<number> {
  return (await LIVE[queue]()).count ?? 0
}

const CARD: Record<Queue, RegExp> = {
  tutorials: /Tutorials awaiting review/,
  reports: /Reports from members/,
  ideas: /Design challenges awaiting review/,
  accounts: /Accounts/,
  organisations: /Organisations Create/,
  orgRequests: /Organisation requests/,
  inbox: /Inbox/,
  testPrints: /Test prints/,
}

/**
 * The card on /admin shows the number the table holds, and the table has moved by
 * at least `by` from `before` (a liveCount read before the action). `by` of 0
 * checks only that the card is live: for a count that other suites also move. Other specs and
 * suites share this database, so the card is compared with the table read
 * moments earlier rather than with an absolute.
 */
export async function expectCardMoved(page: Page, queue: Queue, before: number, by: number) {
  await expect
    .poll(
      async () => {
        const live = await liveCount(queue)
        const shown = await cardCount(page, CARD[queue])
        return { shown: shown === live, moved: by === 0 || (by < 0 ? live <= before + by : live >= before + by) }
      },
      { timeout: 30_000 }
    )
    .toEqual({ shown: true, moved: true })
}

/** Sign in as the person a decision was about and read their notifications page. */
export async function expectInboxLine(page: Page, person: Person, line: string | RegExp) {
  await signIn(page, person.email, person.password)
  await page.goto('/notifications')
  await expect(page.getByText(line)).toBeVisible()
}

export async function pollRow<T>(table: string, id: string, column: string, expected: T) {
  await expect
    .poll(async () => {
      const { data } = await adminClient().from(table).select(column).eq('id', id).maybeSingle()
      return (data as Record<string, unknown> | null)?.[column]
    }, { timeout: 30_000 })
    .toEqual(expected)
}

export async function seedIdea(authorId: string, status: 'pending' | 'challenge', title: string) {
  const { data, error } = await adminClient()
    .from('toy_ideas')
    .insert({ author_id: authorId, title, summary: 'A one-handed grip.', description: 'Why it matters.', intended_use: 'Meals', primary_user: 'A child', status })
    .select('id')
    .single()
  if (error) throw new Error(`seedIdea failed: ${error.message}`)
  return data.id as string
}
