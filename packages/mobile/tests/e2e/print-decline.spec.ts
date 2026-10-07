// journeys: R14
import { test, expect } from '@playwright/test'
import { notificationsFor, partyPage, seedPrintJob, txRow } from './maker-fixtures'

/**
 * A printer declines a request with a stock reason: the card leaves Requests,
 * the row records the reason, and the family's job page says why.
 */
test('declining a print request with a reason tells the family why', async ({ browser, baseURL }) => {
  const job = await seedPrintJob('requested')
  const printerPage = await partyPage(browser, baseURL, job.printer)
  const familyPage = await partyPage(browser, baseURL, job.requester)

  try {
    await printerPage.goto('/print-for-others')
    await expect(printerPage.getByText(job.guideTitle)).toBeVisible()
    await printerPage.getByRole('button', { name: 'Decline…' }).click()
    await printerPage.getByRole('button', { name: 'Too big for my bed' }).click()
    await expect(printerPage.getByText('Nothing waiting')).toBeVisible()

    expect(await txRow(job.id)).toMatchObject({ status: 'rejected', decline_reason: 'Too big for my bed' })
    expect(await notificationsFor(job.requester.id, 'toy_rejected', job.id)).toHaveLength(1)

    await familyPage.goto(`/printing/jobs/${job.id}`)
    await expect(familyPage.getByLabel('Progress: Declined')).toBeVisible()
    await expect(familyPage.getByText(/^Too big for my bed — another/)).toBeVisible()
  } finally {
    await printerPage.context().close()
    await familyPage.context().close()
  }
})
