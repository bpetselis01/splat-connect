import { test, expect, type Page } from '@playwright/test'
import {
  createContributor,
  createAdmin,
  createTutorial,
  acceptTerms,
  deleteUser,
  signIn,
  uniqueTitle,
  adminClient,
} from './helpers'

/**
 * Same accordion shape as the edit page in contributor/edit-tutorial.spec.ts:
 * only Details opens by default, and a closed panel's inputs stay in the DOM,
 * so every query has to be scoped to its own panel.
 */
function panel(page: Page, label: string | RegExp) {
  return page.locator('details').filter({ has: page.locator('summary').filter({ hasText: label }) })
}

async function openPanel(page: Page, label: string | RegExp) {
  const p = panel(page, label)
  await p.locator('summary').click()
  return p
}

async function unreadCount(userId: string) {
  const { count } = await adminClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null)
  return count ?? 0
}

/**
 * The whole collaborator loop in one journey: invite, accept, edit, submit,
 * approve, notify. The API and the individual screens each have their own
 * coverage (routes/collaborators.ts, routes/collaborator-invites.ts,
 * edit-collaborators-section.test.tsx, notifications-list.test.tsx); what
 * this proves is that they are wired together end to end, the way
 * contributor/org-backing.spec.ts proves the delegated-review loop.
 */
test('a collaborator is invited, accepts, edits, submits, and both are notified on approval', async ({
  page,
}) => {
  const author = await createContributor()
  await acceptTerms(author.id)
  const collaborator = await createContributor()
  await acceptTerms(collaborator.id)
  const admin = await createAdmin()
  const title = uniqueTitle('Collab Journey')
  const tutorialId = await createTutorial(author.id, { title, status: 'draft' })

  try {
    // 1. The author signs in to the draft they already own (seeded, like the
    //    backing journey seeds its request — creation has its own coverage in
    //    contributor/upload-flow.spec.ts).
    await signIn(page, author.email, author.password)
    await page.waitForURL('**/dashboard')
    await page.goto(`/tutorials/${tutorialId}/edit`)

    // 2. Invite the collaborator by email from the Collaborators panel.
    const collabPanel = await openPanel(page, 'Collaborators')
    await collabPanel.locator('#invite-email').fill(collaborator.email)
    await collabPanel.getByRole('button', { name: 'Invite' }).click()
    await expect
      .poll(async () => {
        const { data } = await adminClient()
          .from('tutorial_collaborator_invites')
          .select('status')
          .eq('tutorial_id', tutorialId)
          .eq('invited_profile_id', collaborator.id)
          .maybeSingle()
        return data?.status
      })
      .toBe('pending')

    // 3. The collaborator signs in, finds the invite on /notifications — with
    //    the unread badge already counting it — and accepts.
    await signIn(page, collaborator.email, collaborator.password)
    await page.waitForURL('**/dashboard')
    await page.goto('/notifications')
    await expect(
      page.getByText(new RegExp(`invited you to collaborate on "${title}"`))
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /Notifications/ })).toContainText('1')
    await page.getByRole('button', { name: 'Accept' }).click()
    await expect
      .poll(async () => {
        const { data } = await adminClient()
          .from('tutorial_contributors')
          .select('role')
          .eq('tutorial_id', tutorialId)
          .eq('profile_id', collaborator.id)
          .maybeSingle()
        return data?.role
      })
      .toBe('collaborator')

    // 4. As the collaborator, edit the title and submit for review.
    const renamedTitle = `${title} renamed`
    await page.goto(`/tutorials/${tutorialId}/edit`)
    await page.locator('#edit-title').fill(renamedTitle)
    await page.getByRole('button', { name: 'Save details' }).click()
    await expect
      .poll(async () => {
        const { data } = await adminClient()
          .from('tutorials')
          .select('title')
          .eq('id', tutorialId)
          .single()
        return data?.title
      })
      .toBe(renamedTitle)

    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect
      .poll(async () => {
        const { data } = await adminClient()
          .from('tutorials')
          .select('status')
          .eq('id', tutorialId)
          .single()
        return data?.status
      })
      .toBe('pending')

    // 5. The admin approves it.
    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')
    await page.goto('/admin/review')
    await page.getByRole('link', { name: new RegExp(renamedTitle) }).click()
    await page.waitForURL(`**/admin/review/${tutorialId}`)
    await page.getByRole('button', { name: 'Approve — publish to library' }).click()
    await page.waitForLoadState('networkidle')

    // 6. Both the author and the collaborator see the approval on
    //    /notifications, with the unread badge counting it.
    await signIn(page, author.email, author.password)
    await page.waitForURL('**/dashboard')
    await page.goto('/notifications')
    await expect(
      page.getByText(new RegExp(`"${renamedTitle}" was approved and is now published`))
    ).toBeVisible()
    const authorUnread = await unreadCount(author.id)
    expect(authorUnread).toBeGreaterThan(0)
    await expect(page.getByRole('link', { name: /Notifications/ })).toContainText(
      String(authorUnread)
    )

    await signIn(page, collaborator.email, collaborator.password)
    await page.waitForURL('**/dashboard')
    await page.goto('/notifications')
    await expect(
      page.getByText(new RegExp(`"${renamedTitle}" was approved and is now published`))
    ).toBeVisible()
    const collaboratorUnread = await unreadCount(collaborator.id)
    expect(collaboratorUnread).toBeGreaterThan(0)
    await expect(page.getByRole('link', { name: /Notifications/ })).toContainText(
      String(collaboratorUnread)
    )
  } finally {
    await deleteUser(author.id)
    await deleteUser(collaborator.id)
    await deleteUser(admin.id)
  }
})
