import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createTutorial, deleteUser, signIn, uniqueTitle } from '../helpers'

test('a family waiting on a printer is told when it has to answer by', async ({ page }) => {
  const family = await createContributor()
  const maker = await createContributor()
  await acceptTerms(family.id)
  const tutorialId = await createTutorial(maker.id, { title: uniqueTitle('E2E Answer by'), status: 'approved' })
  const admin = adminClient()
  const { data: printer } = await admin
    .from('printers')
    .insert({ owner_id: maker.id, name: 'E2E printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  const { data: job } = await admin
    .from('toy_transactions')
    .insert({
      type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printer!.id,
      requester_id: family.id, owner_id: maker.id, print_group_id: crypto.randomUUID(),
    })
    .select('id')
    .single()
  try {
    await signIn(page, family.email, family.password)
    await page.goto(`/dashboard/print-requests/${job!.id}`)
    await expect(
      page.getByText(/They have until \d{1,2} \w{3} to answer\. You can add a printer or withdraw at any time\./)
    ).toBeVisible()
    await expect(page.getByText('Answer by', { exact: true })).toBeVisible()
  } finally {
    await admin.from('toy_transactions').delete().eq('id', job!.id)
    await admin.from('printers').delete().eq('id', printer!.id)
    await admin.from('tutorials').delete().eq('id', tutorialId)
    await deleteUser(family.id)
    await deleteUser(maker.id)
  }
})
