import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { addSteps } from './guides-fixtures'

// The PDF preview of a guide that has one: reached from the Files tab of a
// stepped guide (its hero button is Start building there), whose footer links to the guide on the website. The no-PDF message is
// covered in guides-detail.spec.ts.

test('Files > View opens the full guide, whose footer links to the guide on the website', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E PDF Guide') })
  await addSteps(id, [{ body: 'Only step.' }])

  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await expect(page.getByText('Full guide')).toBeVisible()
  await expect(page.getByText(/Download PDF/)).toHaveCount(0)
  await page.getByRole('button', { name: 'View', exact: true }).click()

  await expect(page.getByText('No PDF is available for this tutorial yet.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open in browser' })).toHaveCount(0)
  await page.evaluate(() => {
    const w = window as unknown as { opened: string[] }
    w.opened = []
    window.open = (u?: string | URL) => (w.opened.push(String(u)), null)
  })
  await page.getByRole('button', { name: 'Download on the web', exact: true }).click()
  const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened)
  expect(opened).toHaveLength(1)
  expect(opened[0]).toMatch(new RegExp(`/tutorials/${id}$`))
  expect(opened[0]).not.toContain('/storage/v1/')
})
