import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'

// Report a problem from the hero of a guide page: pick a reason, say what
// happened, send, and the SPLAT queue (member_reports) holds the row.

test('G10 a reader reports a guide from its hero and the report lands in the queue', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Reported Guide')
  const id = await createTutorial(author.id, { title })

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Report a problem', exact: true }).click()
  await expect(page.getByText('Tell SPLAT what happened')).toBeVisible()

  // Nothing sends until there is a reason and words; a guide offers three reasons, not six.
  const send = page.getByRole('button', { name: 'Send report', exact: true })
  await expect(send).toBeDisabled()
  await expect(page.getByRole('radio', { name: 'Arrived broken' })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Wrong or missing info', exact: true }).click()
  await expect(send).toBeDisabled()
  await page.getByLabel('What happened?').fill('   ')
  await expect(send).toBeDisabled()

  const body = `Step 2 says "copper side up" <b>twice</b> & 🧸 ${Date.now()}`
  await page.getByLabel('What happened?').fill(body)
  const posted = page.waitForResponse((r) => r.url().endsWith('/api/reports') && r.request().method() === 'POST')
  await send.click()
  expect((await posted).status()).toBe(201)

  await expect(page.getByText('Sent to SPLAT. You will hear back within two days.')).toBeVisible()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByText('Tell SPLAT what happened')).toHaveCount(0)

  const { data } = await adminClient()
    .from('member_reports')
    .select('reporter_id, subject_kind, subject_id, subject_label, category, body, ok_to_contact, status')
    .eq('reporter_id', reader.id)
  expect(data).toEqual([
    {
      reporter_id: reader.id,
      subject_kind: 'guide',
      subject_id: id,
      subject_label: title,
      category: 'wrong_info',
      body,
      ok_to_contact: true,
      status: 'new',
    },
  ])
})

test('G10 a safety report promises a same-day reply, and unticking OK to contact is recorded', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Safety Report Guide') })

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Report a problem', exact: true }).click()
  await page.getByRole('radio', { name: 'Safety concern', exact: true }).click()
  await page.getByLabel('What happened?').fill('The battery door does not latch.')
  await page.getByRole('checkbox', { name: /OK to contact me/ }).click()
  await page.getByRole('button', { name: 'Send report', exact: true }).click()

  await expect(page.getByText('Sent. Safety reports go to the top of the queue — expect a reply today.')).toBeVisible()
  const { data } = await adminClient().from('member_reports').select('category, ok_to_contact').eq('reporter_id', reader.id)
  expect(data).toEqual([{ category: 'safety', ok_to_contact: false }])
})

test('a report that fails to send keeps its words and files nothing', async ({ page }) => {
  const reader = await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Report Fails Guide') })

  await page.goto(`/guides/${id}`)
  await page.route('**/api/reports', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }) : route.continue()
  )
  await page.getByRole('button', { name: 'Report a problem', exact: true }).click()
  await page.getByRole('radio', { name: 'Something else', exact: true }).click()
  await page.getByLabel('What happened?').fill('Keep these words')
  await page.getByRole('button', { name: 'Send report', exact: true }).click()

  await expect(page.getByText('Could not send that. Please try again.')).toBeVisible()
  await expect(page.getByLabel('What happened?')).toHaveValue('Keep these words')
  const { data } = await adminClient().from('member_reports').select('id').eq('reporter_id', reader.id)
  expect(data).toEqual([])
})
