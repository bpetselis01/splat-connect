import { test, expect } from '@playwright/test'
import {
  adminClient,
  createContributor,
  createTutorial,
  makeOrgLeader,
  renameProfile,
  requestBacking,
  uniqueTitle,
} from './helpers'
import { partyPage } from './org-fixtures'
import { notificationsFor, seedPrintJob, txRow } from './maker-fixtures'

/**
 * One chain per seat pair: somebody acts on their screen, the person on the
 * other end finds it in their inbox, and the row opens the right screen. Each
 * asserts the notification row itself (recipient, type, subject) as well as the
 * inbox it renders into. Fixtures are seeded through the service role; the
 * action under test goes through the UI and the real API.
 */

const notesOf = async (recipientId: string, type: string) =>
  (
    await adminClient()
      .from('notifications')
      .select('recipient_id, type, actor_name, tutorial_id, tutorial_title, org_id, read_at')
      .eq('recipient_id', recipientId)
      .eq('type', type)
  ).data ?? []

test('P04 Q06 a family thanking an organisation reaches its leader, whose inbox row opens the profile editor', async ({ browser, baseURL }) => {
  const leader = await createContributor()
  const orgName = uniqueTitle('E2E Chain Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const family = await createContributor()
  const familyPage = await partyPage(browser, baseURL, family)
  const leaderPage = await partyPage(browser, baseURL, leader)
  try {
    // Family -> thanks, from the org's public page.
    await familyPage.goto(`/toy-library/organisation/${orgId}`)
    const posted = familyPage.waitForResponse((r) => r.url().endsWith(`/api/organizations/${orgId}/thanks`) && r.request().method() === 'POST')
    await familyPage.getByRole('button', { name: /^Say thanks to/ }).click()
    await familyPage.getByRole('button', { name: 'Send thanks' }).click()
    expect((await posted).status()).toBe(201)

    // The row: to the leader, naming the org, unread.
    expect(await notesOf(leader.id, 'org_thanked')).toEqual([
      expect.objectContaining({ recipient_id: leader.id, org_id: orgId, read_at: null }),
    ])
    expect(await notesOf(family.id, 'org_thanked')).toEqual([])

    // Leader -> the inbox says so, and the row opens the editor with Hide / Show.
    await leaderPage.goto('/inbox')
    await expect(leaderPage.getByText(/said thanks to your organisation/)).toBeVisible()
    await leaderPage.getByText(/said thanks to your organisation/).click()
    await expect(leaderPage).toHaveURL(/\/organisation\/profile$/)
    await expect(leaderPage.getByText(/has said thanks|have said thanks/).first()).toBeVisible()
    expect((await notesOf(leader.id, 'org_thanked'))[0].read_at).not.toBeNull()
  } finally {
    await familyPage.context().close()
    await leaderPage.context().close()
  }
})

test('L06 Q06 a leader approving a backed guide reaches its author, whose inbox row opens the guide', async ({ browser, baseURL }) => {
  const leader = await createContributor()
  const orgName = uniqueTitle('E2E Approving Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const author = await createContributor()
  await renameProfile(author.id, uniqueTitle('E2E Chain Author'))
  const title = uniqueTitle('E2E Approved Guide')
  const tutorialId = await createTutorial(author.id, { title, status: 'pending' })
  await requestBacking(tutorialId, orgId, 'accepted')
  const leaderPage = await partyPage(browser, baseURL, leader)
  const authorPage = await partyPage(browser, baseURL, author)
  try {
    // Leader -> Approve, in the review queue.
    await leaderPage.goto(`/organisation/${tutorialId}`)
    const reviewed = leaderPage.waitForResponse((r) => r.url().endsWith(`/api/tutorials/${tutorialId}/review`) && r.request().method() === 'POST')
    await leaderPage.getByRole('button', { name: 'Approve', exact: true }).click()
    expect((await reviewed).status()).toBe(200)
    const { data: guide } = await adminClient().from('tutorials').select('status').eq('id', tutorialId).single()
    expect(guide?.status).toBe('approved')

    // The row: to the author, naming the guide and the organisation.
    expect(await notesOf(author.id, 'tutorial_approved')).toEqual([
      { recipient_id: author.id, type: 'tutorial_approved', actor_name: orgName, tutorial_id: tutorialId, tutorial_title: title, org_id: null, read_at: null },
    ])

    // Author -> the inbox says so, and the row opens the guide's editor.
    await authorPage.goto('/inbox')
    const row = authorPage.getByText(`"${title}" was approved and is now published`)
    await expect(row).toBeVisible()
    await row.click()
    await expect(authorPage).toHaveURL(new RegExp(`/tutorials/${tutorialId}$`))
    await expect.poll(async () => (await notesOf(author.id, 'tutorial_approved'))[0].read_at).not.toBeNull()
  } finally {
    await leaderPage.context().close()
    await authorPage.context().close()
  }
})

test('R07 Q06 a printer starting a job reaches the requester, whose inbox thread opens the print job', async ({ browser, baseURL }) => {
  const job = await seedPrintJob('accepted')
  const printerPage = await partyPage(browser, baseURL, job.printer)
  const familyPage = await partyPage(browser, baseURL, job.requester)
  try {
    // Printer -> Started printing, on the job page.
    await printerPage.goto(`/printing/jobs/${job.id}`)
    await printerPage.getByRole('button', { name: 'Started printing' }).click()
    await expect(printerPage.getByLabel('Progress: Printing')).toBeVisible()
    expect((await txRow(job.id)).printing_started_at).not.toBeNull()

    // The row: to the requester, in the printer's name, about this job.
    expect(await notificationsFor(job.requester.id, 'print_started', job.id)).toEqual([
      expect.objectContaining({ actor_name: job.printerOwnerName, toy_transaction_id: job.id }),
    ])
    const { data: row } = await adminClient()
      .from('notifications')
      .select('recipient_id, toy_name, read_at')
      .eq('recipient_id', job.requester.id)
      .eq('type', 'print_started')
      .single()
    expect(row).toEqual({ recipient_id: job.requester.id, toy_name: job.guideTitle, read_at: null })

    // Requester -> the thread is lit with the system line, and opens the job screen.
    await familyPage.goto('/inbox')
    const card = familyPage.getByRole('button', { name: new RegExp(job.guideTitle) })
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('aria-label', new RegExp(`with ${job.printerOwnerName}$`))
    await expect(card.getByText('The job is on the bed.')).toBeVisible()
    await card.click()
    await expect(familyPage).toHaveURL(new RegExp(`/printing/jobs/${job.id}$`))
    await expect(familyPage.getByLabel('Progress: Printing')).toBeVisible()
    await expect.poll(async () => (await notificationsFor(job.requester.id, 'print_started', job.id)).length).toBe(1)
    const { data: after } = await adminClient()
      .from('notifications')
      .select('read_at')
      .eq('recipient_id', job.requester.id)
      .eq('type', 'print_started')
      .single()
    expect(after?.read_at).not.toBeNull()
  } finally {
    await printerPage.context().close()
    await familyPage.context().close()
  }
})
