// journeys: S02 S03
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, renameProfile, signInAsNewContributor, uniqueTitle } from './helpers'

// A contributor's showcase page seen by another signed-in member: Say thanks
// (117) and Report person (065). Each test makes its own subject.

async function showcaseSubject() {
  const subject = await createContributor()
  const name = uniqueTitle('Showcase Maker')
  await renameProfile(subject.id, name)
  await createTutorial(subject.id, { title: uniqueTitle('E2E Showcase Subject Guide') })
  return { ...subject, name }
}

test('Say thanks flashes the confirmation, stores one thanks, and tells the person', async ({ page }) => {
  const thanker = await signInAsNewContributor(page)
  const subject = await showcaseSubject()

  await page.goto(`/guides/contributor/${subject.id}`)
  await expect(page.getByText('Thanked 0 times')).toBeVisible()
  const posted = page.waitForResponse((r) => r.url().endsWith(`/api/contributors/${subject.id}/thanks`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Say thanks', exact: true }).click()
  expect((await posted).status()).toBe(201)

  await expect(page.getByText('Thanks sent — they will see it in their notifications')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Say thanks', exact: true })).toBeDisabled()

  const admin = adminClient()
  const { data: thanks } = await admin.from('profile_thanks').select('thanker_id').eq('profile_id', subject.id)
  expect(thanks).toEqual([{ thanker_id: thanker.id }])
  const { data: profile } = await admin.from('profiles').select('profile_thanks_count').eq('id', subject.id).single()
  expect(profile?.profile_thanks_count).toBe(1)
  const { data: told } = await admin.from('notifications').select('type').eq('recipient_id', subject.id)
  expect(told?.map((n) => n.type)).toContain('profile_thanked')

  // A fresh load says the same thing the row does.
  await page.reload()
  await expect(page.getByText('Thanked 1 time', { exact: true })).toBeVisible()
})

test('Report a problem on a person files a member report naming them', async ({ page }) => {
  const reporter = await signInAsNewContributor(page)
  const subject = await showcaseSubject()

  await page.goto(`/guides/contributor/${subject.id}`)
  await page.getByRole('button', { name: /Report a problem/ }).click()
  await expect(page.getByText('Tell SPLAT what happened')).toBeVisible()
  await page.getByRole('radio', { name: 'Behaviour', exact: true }).click()
  const body = `Rude in the thread ${Date.now()}`
  await page.getByLabel('What happened?').fill(body)
  const posted = page.waitForResponse((r) => r.url().endsWith('/api/reports') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Send report', exact: true }).click()
  expect((await posted).status()).toBe(201)
  await expect(page.getByText('Sent to SPLAT. You will hear back within two days.')).toBeVisible()

  const { data } = await adminClient()
    .from('member_reports')
    .select('subject_kind, subject_id, subject_label, category, body, status')
    .eq('reporter_id', reporter.id)
  expect(data).toEqual([
    { subject_kind: 'person', subject_id: subject.id, subject_label: subject.name, category: 'conduct', body, status: 'new' },
  ])
})
