import { test, expect } from '@playwright/test'
import { createContributor, signIn } from './helpers'
import { seedMemberReport } from './admin-fixtures'

test('Q21 My reports lists each report with its status and shows SPLAT’s reply', async ({ page }) => {
  const reporter = await createContributor()
  const sent = await seedMemberReport(reporter.id)
  const looking = await seedMemberReport(reporter.id, { status: 'looking', note: 'We are checking with the maker.' })
  const done = await seedMemberReport(reporter.id, { status: 'resolved', note: 'Fixed, thank you.' })
  const other = await createContributor()
  const notMine = await seedMemberReport(other.id)
  await signIn(page, reporter.email, reporter.password)
  await expect(page).toHaveURL(/\/home$/)

  await page.goto('/reports')
  const item = (label: string) => page.getByText(label, { exact: true }).locator('xpath=ancestor::*[.//*[text()="Sent" or text()="Being looked at" or text()="Resolved"]][1]')
  await expect(item(sent.label)).toContainText('Sent')
  await expect(item(looking.label)).toContainText('Being looked at')
  await expect(item(done.label)).toContainText('Resolved')
  await expect(page.getByText('We are checking with the maker.')).toBeVisible()
  await expect(page.getByText('Fixed, thank you.')).toBeVisible()
  await expect(page.getByText('From SPLAT')).toHaveCount(2)
  await expect(page.getByText(notMine.label, { exact: true })).toHaveCount(0)
})
