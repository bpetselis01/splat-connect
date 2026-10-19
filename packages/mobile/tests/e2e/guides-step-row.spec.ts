import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { addSteps } from './guides-fixtures'

test('G14 a step row on the guide opens build mode on that step', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Step Row') })
  await addSteps(id, [
    { title: 'Open the bay', body: 'Undo one screw.' },
    { title: 'Swap the cell', body: 'Mind the polarity.' },
    { title: 'Close it', body: 'Click.' },
  ])

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Step 2: Swap the cell', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${id}/build`))
  await expect(page.getByText('Step 2 of 3')).toBeVisible()
  await expect(page.getByText('Mind the polarity.', { exact: true })).toBeVisible()
  await expect(page.getByText('Undo one screw.', { exact: true })).toHaveCount(0)
})
