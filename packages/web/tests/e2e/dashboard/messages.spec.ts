import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createOrg, deleteUser, makeLeader, signIn, uniqueTitle } from '../helpers'

test('WD35 a family and an organisation leader exchange messages in the conversation, and a stranger cannot open it', async ({ browser }) => {
  const family = await createContributor()
  const leader = await createContributor()
  const stranger = await createContributor()
  for (const u of [family, leader, stranger]) await acceptTerms(u.id)
  const orgName = uniqueTitle('Northbank')
  const orgId = await createOrg(orgName)
  await makeLeader(leader.id, undefined, orgId)
  const db = adminClient()
  const { data: convo } = await db.from('org_conversations').insert({ org_id: orgId, profile_id: family.id }).select('id').single()
  await db.from('org_messages').insert({ conversation_id: convo!.id, sender_id: family.id, body: 'Can we come on Thursday?' })
  const thread = `/dashboard/messages/${convo!.id}`
  const bodies = async () => (await db.from('org_messages').select('body, sender_id').eq('conversation_id', convo!.id).order('created_at')).data!

  const open = async (user: { email: string; password: string }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await signIn(page, user.email, user.password)
    return { page, context }
  }

  const f = await open(family)
  const l = await open(leader)
  const s = await open(stranger)
  try {
    await f.page.goto(thread)
    await expect(f.page.getByRole('heading', { level: 1 })).toHaveText(orgName)
    await expect(f.page.getByText('Can we come on Thursday?')).toBeVisible()
    await f.page.getByPlaceholder('Write a message').fill('With our own switch?')
    await f.page.getByRole('button', { name: 'Send' }).click()
    await expect(f.page.getByText('With our own switch?')).toBeVisible()
    expect(await bodies()).toEqual([
      { body: 'Can we come on Thursday?', sender_id: family.id },
      { body: 'With our own switch?', sender_id: family.id },
    ])

    await l.page.goto(thread)
    await expect(l.page.getByRole('heading', { level: 1 })).toHaveText(`${family.name}, writing to ${orgName}`)
    // Shown below the lg breakpoint only, so the desktop run reads its target, not its visibility.
    await expect(l.page.getByRole('link', { name: /Messages/, includeHidden: true })).toHaveAttribute('href', '/dashboard/organisation/messages')
    await expect(l.page.getByText('With our own switch?')).toBeVisible()
    await l.page.getByPlaceholder('Write a message').fill('Yes, bring it.')
    await l.page.getByRole('button', { name: 'Send' }).click()
    await expect(l.page.getByText('Yes, bring it.')).toBeVisible()

    await f.page.reload()
    await expect(f.page.getByText('Yes, bring it.')).toBeVisible()
    const told = await db.from('notifications').select('type, org_conversation_id').eq('recipient_id', family.id)
    expect(told.data).toEqual([{ type: 'org_message', org_conversation_id: convo!.id }])

    const res = await s.page.goto(thread)
    expect(res?.status()).toBe(404)
    await expect(s.page.getByText('Yes, bring it.')).toHaveCount(0)
  } finally {
    await Promise.all([f.context.close(), l.context.close(), s.context.close()])
    await db.from('organizations').delete().eq('id', orgId)
    for (const u of [family, leader, stranger]) await deleteUser(u.id)
  }
})
