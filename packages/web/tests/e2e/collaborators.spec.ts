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
  pageUntilVisible,
  fillDetail,
} from './helpers'

/**
 * Same pill-row stepper as the edit page in contributor/edit-tutorial.spec.ts:
 * clicking a tab swaps in that step's content, and only the active step's DOM
 * exists at all (unmounted, not just hidden), so most queries need no
 * scoping. Scoping via the returned tabpanel locator is still safe and keeps
 * the pattern uniform.
 */
async function openStep(page: Page, label: string | RegExp) {
  await page.getByRole('tab', { name: label }).click()
  return page.getByRole('tabpanel')
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
test('WT30 a collaborator is invited, accepts, edits, submits, and both are notified on approval', async ({
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

    // 2. Invite the collaborator by email from the Team step, which holds the
    //    collaborator list and the backing panel below it.
    const collabPanel = await openStep(page, 'Team')
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
    //
    //    The badge is read off the My SPLAT hub card rather than a nav row:
    //    the rail carried it until 2026-09-17, and the hub is where buildNav's
    //    count renders now. Asserted BEFORE opening /notifications, because
    //    reading them is what clears it.
    await signIn(page, collaborator.email, collaborator.password)
    await page.waitForURL('**/dashboard')
    await expect(page.getByRole('link', { name: /Notifications/ })).toContainText('1')

    await page.goto('/notifications')
    await expect(
      page.getByText(new RegExp(`invited you to collaborate on "${title}"`))
    ).toBeVisible()
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
    // The editor opens on Status (a1535727); the title lives on Details.
    await page.goto(`/tutorials/${tutorialId}/edit?step=details`)
    await fillDetail(page, 'title', renamedTitle)
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

    // Submitting sits in the editor header (and the Status section).
    await page.getByRole('button', { name: 'Submit for review' }).first().click()
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

    // 5. The admin approves it, from the queue's side pane (39672abf).
    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')
    // The queue is oldest first and paged; a page past the end clamps to the
    // last, which is where a guide submitted seconds ago sits.
    await page.goto('/admin/review?page=9999')
    await page.waitForLoadState('networkidle')
    await pageUntilVisible(page, page.getByRole('link', { name: new RegExp(renamedTitle) }))
    await page.getByRole('link', { name: new RegExp(renamedTitle) }).click()
    await page.waitForURL(new RegExp(`/admin/review\\?(page=\\d+&)?selected=${tutorialId}$`))
    await page
      .getByRole('complementary', { name: `Reviewing ${renamedTitle}` })
      .getByRole('button', { name: 'Approve', exact: true })
      .click()
    await expect
      .poll(async () => {
        const { data } = await adminClient()
          .from('tutorials')
          .select('status')
          .eq('id', tutorialId)
          .single()
        return data?.status
      })
      .toBe('approved')

    // 6. Both the author and the collaborator see the approval on
    //    /notifications, with the unread badge on the hub counting it — read
    //    from /dashboard first, since the badge no longer rides along on every
    //    page the way the rail's row did.
    await signIn(page, author.email, author.password)
    await page.waitForURL('**/dashboard')
    const authorUnread = await unreadCount(author.id)
    expect(authorUnread).toBeGreaterThan(0)
    await expect(page.getByRole('link', { name: /Notifications/ })).toContainText(
      String(authorUnread)
    )

    await page.goto('/notifications')
    await expect(
      page.getByText(new RegExp(`"${renamedTitle}" was approved and is now published`))
    ).toBeVisible()

    await signIn(page, collaborator.email, collaborator.password)
    await page.waitForURL('**/dashboard')
    const collaboratorUnread = await unreadCount(collaborator.id)
    expect(collaboratorUnread).toBeGreaterThan(0)
    await expect(page.getByRole('link', { name: /Notifications/ })).toContainText(
      String(collaboratorUnread)
    )

    await page.goto('/notifications')
    await expect(
      page.getByText(new RegExp(`"${renamedTitle}" was approved and is now published`))
    ).toBeVisible()
  } finally {
    await deleteUser(author.id)
    await deleteUser(collaborator.id)
    await deleteUser(admin.id)
  }
})

test('WT30 the primary removes a collaborator, and a collaborator leaves; each tells the other', async ({ page, browser }) => {
  const author = await createContributor()
  await acceptTerms(author.id)
  const removed = await createContributor()
  const leaver = await createContributor()
  await acceptTerms(leaver.id)
  const title = uniqueTitle('Collab Exit')
  const tutorialId = await createTutorial(author.id, { title, status: 'draft' })
  const { error } = await adminClient().from('tutorial_contributors').insert([
    { tutorial_id: tutorialId, profile_id: removed.id, role: 'collaborator' },
    { tutorial_id: tutorialId, profile_id: leaver.id, role: 'collaborator' },
  ])
  expect(error).toBeNull()
  const seats = async () =>
    ((await adminClient().from('tutorial_contributors').select('profile_id').eq('tutorial_id', tutorialId)).data ?? []).map((r) => r.profile_id).sort()

  try {
    await signIn(page, leaver.email, leaver.password)
    await page.waitForURL('**/dashboard')
    await page.goto(`/tutorials/${tutorialId}/edit`)
    const mine = await openStep(page, 'Team')
    await mine.getByRole('button', { name: 'Leave' }).click()
    await expect(page.getByRole('status')).toContainText('Left tutorial')
    await expect.poll(seats).toEqual([author.id, removed.id].sort())

    const ownerCtx = await browser.newContext()
    const owner = await ownerCtx.newPage()
    await signIn(owner, author.email, author.password)
    await owner.goto('/notifications')
    await expect(owner.getByText(new RegExp(`left "${title}"`))).toBeVisible()
    await owner.goto(`/tutorials/${tutorialId}/edit`)
    const team = await openStep(owner, 'Team')
    await team.getByRole('button', { name: 'Remove' }).click()
    await expect(owner.getByRole('status')).toContainText('Removed collaborator')
    await expect.poll(seats).toEqual([author.id])
    await ownerCtx.close()

    const goneCtx = await browser.newContext()
    const gone = await goneCtx.newPage()
    await signIn(gone, removed.email, removed.password)
    await gone.goto('/notifications')
    await expect(gone.getByText(new RegExp(`removed you from "${title}"`))).toBeVisible()
    await goneCtx.close()
  } finally {
    await deleteUser(author.id)
    await deleteUser(removed.id)
    await deleteUser(leaver.id)
  }
})
