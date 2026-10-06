import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { addSteps } from './guides-fixtures'

// The PDF preview of a guide that has one: reached from the Files tab of a
// stepped guide (its hero button is Start building there), with Open in
// browser handing the signed link to the browser. The no-PDF message is
// covered in guides-detail.spec.ts.

test('Files > Download PDF opens the preview, and Open in browser opens the guide\'s signed PDF link', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E PDF Guide') })
  await addSteps(id, [{ body: 'Only step.' }])

  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Open in browser', exact: true })).toBeVisible()
  await expect(page.getByText('No PDF is available for this tutorial yet.')).toHaveCount(0)

  // The browser is the system viewer here: record what window.open is asked for
  // instead of racing a cross-origin popup's first navigation.
  await page.evaluate(() => {
    const w = window as unknown as { opened: string[] }
    w.opened = []
    window.open = (u?: string | URL) => (w.opened.push(String(u)), null)
  })
  await page.getByRole('button', { name: 'Open in browser', exact: true }).click()
  // Private bucket (049): the link is a short-lived signed URL for this guide's own object.
  const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened)
  expect(opened).toHaveLength(1)
  const url = opened[0]!
  expect(url).toContain(`/storage/v1/object/sign/tutorial-pdfs/${id}/tutorial.pdf`)
  expect(url).toContain('token=')
})
