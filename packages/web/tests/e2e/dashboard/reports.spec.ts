import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createAdmin, createContributor, deleteUser, signIn, uniqueTitle } from '../helpers'

test('WD28 My reports shows each report with its status and SPLAT’s reply, and nobody else’s', async ({ page }) => {
  const m = await createContributor()
  await acceptTerms(m.id)
  const other = await createContributor()
  const admin = await createAdmin()
  const resolved = uniqueTitle('Guide: Resolved one')
  const waiting = uniqueTitle('Toy: Waiting one')
  const someoneElses = uniqueTitle('Toy: Not mine')
  const seed = (reporter: string, subject_label: string, status: string, note_to_reporter: string | null = null) => ({
    reporter_id: reporter, subject_kind: 'other', subject_label, category: 'safety', body: 'A sharp edge.',
    status, note_to_reporter, ...(status === 'resolved' ? { handled_by: admin.id } : {}),
  })
  const { error } = await adminClient().from('member_reports').insert([
    seed(m.id, resolved, 'resolved', 'We added a cover.'),
    seed(m.id, waiting, 'new'),
    seed(other.id, someoneElses, 'new'),
  ])
  if (error) throw new Error(error.message)
  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/reports')
    const item = (label: string) => page.getByRole('listitem').filter({ hasText: label })
    await expect(item(resolved)).toContainText('Resolved')
    await expect(item(resolved)).toContainText('From SPLAT: We added a cover.')
    await expect(item(waiting)).toContainText('Sent')
    await expect(page.getByText(someoneElses)).toHaveCount(0)
  } finally {
    await deleteUser(m.id)
    await deleteUser(other.id)
    await deleteUser(admin.id)
  }
})
