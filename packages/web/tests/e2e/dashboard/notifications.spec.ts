import { test, expect, type Page } from '@playwright/test'
import {
  acceptTerms,
  adminClient,
  createContributor,
  createNotification,
  createOrg,
  createTutorial,
  deleteUser,
  signIn,
  uniqueTitle,
} from '../helpers'

// The header's unread badge is the number the Member sees on every page.
const badge = (page: Page) => page.getByRole('banner').locator('.nav-account__badge')

async function member() {
  const m = await createContributor()
  await acceptTerms(m.id)
  return m
}

async function unread(userId: string) {
  const { count } = await adminClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null)
  return count ?? 0
}

async function seedApproved(userId: string, title: string) {
  const tutorialId = await createTutorial(userId, { title, status: 'approved' })
  const id = await createNotification(userId, { type: 'tutorial_approved', tutorial_id: tutorialId, tutorial_title: title })
  return { tutorialId, id }
}

test('WD37 lists every notification, newest first, with an Unread dot on each unread one', async ({ page }) => {
  const m = await member()
  const [a, b, c] = [uniqueTitle('Oldest'), uniqueTitle('Middle'), uniqueTitle('Newest')]
  await seedApproved(m.id, a)
  await seedApproved(m.id, b)
  const newest = await seedApproved(m.id, c)
  await adminClient().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', newest.id)

  try {
    await signIn(page, m.email, m.password)
    await page.goto('/notifications')

    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
    const rows = page.getByRole('listitem').filter({ has: page.getByRole('button') })
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText(`"${c}" was approved and is now published`)
    await expect(rows.nth(1)).toContainText(b)
    await expect(rows.nth(2)).toContainText(a)
    await expect(page.getByLabel('Unread')).toHaveCount(2)
    await expect(rows.nth(0).getByLabel('Unread')).toHaveCount(0)
    await expect(badge(page)).toHaveText('2')
  } finally {
    await deleteUser(m.id)
  }
})

test('WD38 opening a row marks only it read, the header badge drops by one, and the page it is about opens', async ({ page }) => {
  const m = await member()
  const keep = await seedApproved(m.id, uniqueTitle('Stays unread'))
  const open = await seedApproved(m.id, uniqueTitle('Opened'))

  try {
    await signIn(page, m.email, m.password)
    await page.goto('/notifications')
    await expect(badge(page)).toHaveText('2')

    await page.getByRole('button', { name: /Opened/ }).click()
    await expect(page).toHaveURL(`/tutorials/${open.tutorialId}/edit`)

    await expect.poll(() => unread(m.id)).toBe(1)
    const { data } = await adminClient().from('notifications').select('id, read_at').eq('recipient_id', m.id)
    expect(data!.find((n) => n.id === open.id)!.read_at).not.toBeNull()
    expect(data!.find((n) => n.id === keep.id)!.read_at).toBeNull()

    await page.goto('/notifications')
    await expect(badge(page)).toHaveText('1')
  } finally {
    await deleteUser(m.id)
  }
})

test('WD39 Mark all read clears every unread row, the dots, the button and the header badge', async ({ page }) => {
  const m = await member()
  for (const t of ['One', 'Two', 'Three']) await seedApproved(m.id, uniqueTitle(t))

  try {
    await signIn(page, m.email, m.password)
    await page.goto('/notifications')
    await expect(badge(page)).toHaveText('3')

    await page.getByRole('button', { name: 'Mark all read' }).click()

    await expect(page.getByLabel('Unread')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mark all read' })).toHaveCount(0)
    await expect(badge(page)).toHaveCount(0)
    expect(await unread(m.id)).toBe(0)
  } finally {
    await deleteUser(m.id)
  }
})

test('WD40 a collaborator invitation is accepted and another declined from the list', async ({ page }) => {
  const m = await member()
  const author = await createContributor()
  const take = await seedApproved(author.id, uniqueTitle('Take the seat'))
  const leave = await seedApproved(author.id, uniqueTitle('Turn it down'))
  const db = adminClient()
  const invite = async (tutorialId: string, title: string) => {
    const { data, error } = await db
      .from('tutorial_collaborator_invites')
      .insert({ tutorial_id: tutorialId, invited_profile_id: m.id, invited_by: author.id })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    await createNotification(m.id, { type: 'collaborator_invited', actor_name: author.name, tutorial_id: tutorialId, tutorial_title: title })
    return data.id
  }
  const takeTitle = (await db.from('tutorials').select('title').eq('id', take.tutorialId).single()).data!.title
  const leaveTitle = (await db.from('tutorials').select('title').eq('id', leave.tutorialId).single()).data!.title
  const takeInvite = await invite(take.tutorialId, takeTitle)
  const leaveInvite = await invite(leave.tutorialId, leaveTitle)

  try {
    await signIn(page, m.email, m.password)
    await page.goto('/notifications')
    const rowFor = (title: string) => page.getByRole('listitem').filter({ hasText: `invited you to collaborate on "${title}"` })
    await expect(rowFor(takeTitle).getByRole('button', { name: 'Accept' })).toBeVisible()

    await rowFor(takeTitle).getByRole('button', { name: 'Accept' }).click()
    await expect(rowFor(takeTitle).getByRole('button', { name: 'Accept' })).toHaveCount(0)
    await rowFor(leaveTitle).getByRole('button', { name: 'Decline' }).click()
    await expect(rowFor(leaveTitle).getByRole('button', { name: 'Decline' })).toHaveCount(0)

    const seat = (id: string) =>
      db.from('tutorial_contributors').select('role').eq('tutorial_id', id).eq('profile_id', m.id).maybeSingle()
    expect((await seat(take.tutorialId)).data?.role).toBe('collaborator')
    expect((await seat(leave.tutorialId)).data).toBeNull()
    const status = async (id: string) => (await db.from('tutorial_collaborator_invites').select('status').eq('id', id).single()).data!.status
    expect(await status(takeInvite)).toBe('accepted')
    expect(await status(leaveInvite)).toBe('declined')
    const told = await db.from('notifications').select('type').eq('recipient_id', author.id).in('type', ['collaborator_accepted', 'collaborator_declined'])
    expect(told.data!.map((n) => n.type).sort()).toEqual(['collaborator_accepted', 'collaborator_declined'])
  } finally {
    await deleteUser(m.id)
    await deleteUser(author.id)
  }
})

// Recorded, not fixed (inventory suspect 1): the organisations bucket has no
// MarkNotificationsRead on any dashboard page, so only a row click on
// /notifications clears an org notification. The tutorials bucket is the control.
test('an organisation notification stays unread on every bucket page, while a tutorials one clears', async ({ page }) => {
  const m = await member()
  const orgId = await createOrg(uniqueTitle('Bucket Org'))
  const tutorial = await seedApproved(m.id, uniqueTitle('Control'))
  const { data: org } = await adminClient()
    .from('notifications')
    .insert({ recipient_id: m.id, type: 'org_thanked', actor_name: 'A family', org_id: orgId })
    .select('id')
    .single()

  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/tutorials')
    await expect.poll(async () => (await adminClient().from('notifications').select('read_at').eq('id', tutorial.id).single()).data!.read_at).not.toBeNull()
    for (const path of ['/dashboard/exchanges', '/dashboard/challenges', '/dashboard/tutorials']) {
      await page.goto(path)
      await expect(page.getByRole('main')).toBeVisible()
    }
    const { data } = await adminClient().from('notifications').select('read_at').eq('id', org!.id).single()
    expect(data!.read_at).toBeNull()
    await expect(badge(page)).toHaveText('1')
  } finally {
    await adminClient().from('organizations').delete().eq('id', orgId)
    await deleteUser(m.id)
  }
})
