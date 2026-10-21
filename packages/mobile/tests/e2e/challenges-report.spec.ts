import { test, expect } from '@playwright/test'
import { adminClient, createChallenge, createContributor, renameProfile, signInAsNewContributor, uniqueTitle } from './helpers'

/**
 * Reporting a challenge participant: the report is stored, nothing is removed,
 * and the person's posts drop out of the reporter's thread. Read back from the tables.
 */
test('C16 Report on a participant stores the reason, hides their posts from the reporter and removes nobody', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const author = await createContributor()
  const other = await createContributor()
  const otherName = uniqueTitle('E2E Reported Maker')
  await renameProfile(other.id, otherName)
  const id = await createChallenge(author.id, { title: uniqueTitle('E2E Report Challenge') })
  const admin = adminClient()
  const { error } = await admin.from('toy_idea_participants').insert([
    { idea_id: id, profile_id: me.id },
    { idea_id: id, profile_id: other.id },
  ])
  if (error) throw new Error(`participate failed: ${error.message}`)
  const said = `Hello from ${otherName}`
  await admin.from('toy_idea_messages').insert({ idea_id: id, sender_id: other.id, kind: 'user', body: said })

  await page.goto(`/explore/challenges/${id}`)
  await page.getByRole('tab', { name: /^Thread/ }).click()
  await expect(page.getByText(said)).toBeVisible()
  await page.getByRole('tab', { name: /^Makers/ }).click()
  await expect(page.getByText(otherName)).toBeVisible()
  await page.getByRole('button', { name: `Report ${otherName}` }).click()
  await expect(page.getByText("You won't see them here any more. SPLAT will look at it, and they won't see your name.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send report' })).toBeDisabled()
  await page.getByLabel('Why are you reporting them?').fill('Pushed me to share my address')
  await page.getByRole('button', { name: 'Send report' }).click()

  await page.getByRole('tab', { name: /^Thread/ }).click()
  await expect(page.getByText(said)).toHaveCount(0)

  const { data: reports } = await admin.from('toy_idea_reports').select('reason, reported_by, reported_profile_id, resolved_at').eq('idea_id', id)
  expect(reports).toEqual([{ reason: 'Pushed me to share my address', reported_by: me.id, reported_profile_id: other.id, resolved_at: null }])
  const { data: part } = await admin.from('toy_idea_participants').select('removed_at').eq('idea_id', id).eq('profile_id', other.id).single()
  expect(part).toEqual({ removed_at: null })
})
