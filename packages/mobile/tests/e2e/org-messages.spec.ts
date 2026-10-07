// journeys: L28 L29
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, renameProfile, signInAsNewContributor, uniqueTitle } from './helpers'
import { addOrgLeader, notificationsOf, partyPage } from './org-fixtures'

/**
 * Messages with an organisation, both sides. A family writes from the org's
 * page; every leader sees the conversation in the org inbox and any of them
 * can answer, signed with the organisation's name on the family's side. Each
 * message leaves one org_message notification per recipient.
 */

test('a family message reaches the org inbox of every leader, and a leader reply reaches the family', async ({
  page,
  browser,
  baseURL,
}) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Messaging Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const colleague = await createContributor()
  await addOrgLeader(orgId, colleague.id)
  const family = await createContributor()
  const familyName = uniqueTitle('Writing Family')
  await renameProfile(family.id, familyName)

  const familyPage = await partyPage(browser, baseURL, family)
  const colleaguePage = await partyPage(browser, baseURL, colleague)
  try {
    // The family writes from the organisation's page.
    await familyPage.goto(`/toy-library/organisation/${orgId}`)
    await familyPage.getByRole('button', { name: 'Message', exact: true }).click()
    const question = uniqueTitle('Do you take switch toys')
    await familyPage.getByLabel(`Message ${orgName}`, { exact: true }).fill(question)
    await familyPage.getByRole('button', { name: 'Send', exact: true }).click()
    // Scoped to the log: the draft box also holds this text until the send lands.
    await expect(familyPage.getByRole('list', { name: 'Conversation' }).getByText(question)).toBeVisible()

    const { data: convo } = await adminClient()
      .from('org_conversations')
      .select('id')
      .eq('org_id', orgId)
      .eq('profile_id', family.id)
      .single()
    const { data: sent } = await adminClient().from('org_messages').select('sender_id, body').eq('conversation_id', convo!.id)
    expect(sent).toEqual([{ sender_id: family.id, body: question }])
    // Every leader is told once, naming the family and the organisation.
    for (const l of [leader, colleague]) {
      expect(await notificationsOf(l.id, 'org_message')).toEqual([
        expect.objectContaining({ org_conversation_id: convo!.id, actor_name: familyName, tutorial_title: orgName }),
      ])
    }

    // L28: the org inbox lists the conversation with the family's name and last line.
    await page.goto('/organisation/messages')
    await expect(page.getByText(`Families writing to ${orgName}.`, { exact: false })).toBeVisible()
    const row = page.getByRole('button', { name: familyName })
    await expect(row).toBeVisible()
    await expect(row.getByText(question)).toBeVisible()

    // The other leader sees the same row.
    await colleaguePage.goto('/organisation/messages')
    await expect(colleaguePage.getByRole('button', { name: familyName })).toBeVisible()

    // L29: reply from the thread.
    await row.click()
    await expect(page.getByText(`${familyName}, writing to ${orgName}`)).toBeVisible()
    const log = page.getByRole('list', { name: 'Conversation' })
    await expect(log.getByText(question)).toBeVisible()
    const answer = uniqueTitle('Yes we do')
    await page.getByLabel(`Message ${familyName}`, { exact: true }).fill(answer)
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(log.getByText(answer)).toBeVisible()

    const { data: all } = await adminClient()
      .from('org_messages')
      .select('sender_id, body')
      .eq('conversation_id', convo!.id)
      .order('created_at')
    expect(all).toEqual([
      { sender_id: family.id, body: question },
      { sender_id: leader.id, body: answer },
    ])
    expect(await notificationsOf(family.id, 'org_message')).toEqual([
      expect.objectContaining({ org_conversation_id: convo!.id, actor_name: orgName, tutorial_title: orgName }),
    ])

    // The family sees the answer signed by the organisation, and its inbox line.
    await familyPage.reload()
    await expect(familyPage.getByRole('list', { name: 'Conversation' }).getByText(answer)).toBeVisible()
    await familyPage.goto('/inbox')
    await expect(familyPage.getByText(`${orgName} replied to your message`)).toBeVisible()
    // The colleague's list now shows the answer as "You: ..." from the org's side.
    await colleaguePage.reload()
    await expect(colleaguePage.getByRole('button', { name: familyName }).getByText(`You: ${answer}`)).toBeVisible()
  } finally {
    await familyPage.context().close()
    await colleaguePage.context().close()
  }
})

test('with no conversations the org inbox says nobody has written yet', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  await makeOrgLeader(leader.id, uniqueTitle('E2E Quiet Org'))
  await page.goto('/organisation/messages')
  await expect(page.getByText('Nobody has written yet.')).toBeVisible()
})
