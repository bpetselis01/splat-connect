import { test, expect } from '@playwright/test'
import { createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { addSteps } from './guides-fixtures'

// The web twin of .maestro/flows/guide-page.yaml, minus the hero swipe (a
// native pager): Guides from Home, a guide, build mode and its own ✕, then the
// header ✕ closing the whole trail back to the library with the tab bar.

test('B05 build mode\'s ✕ returns to the guide at Pick up, and the header ✕ closes the trail to the library with the tab bar', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Close Trail')
  const id = await createTutorial(contributor.id, { title })
  await addSteps(id, [{ title: 'Open the bay', body: 'Undo one screw.' }, { title: 'Close it', body: 'Click.' }])

  await page.getByRole('button', { name: 'Guides', exact: true }).click()
  await expect(page).toHaveURL(/\/guides$/)
  await page.getByPlaceholder('Search guides').fill(title)
  await page.getByRole('button', { name: new RegExp(`^${title}`) }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
  // A pushed screen: no tab bar, a ✕ and no Back.
  await expect(page.getByRole('tab', { name: 'Home' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Get ready' })).toBeVisible()
  await page.getByRole('button', { name: 'Start step 1', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Step 2 of 2')).toBeVisible()

  await page.getByRole('button', { name: 'Close build mode' }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
  await expect(page.getByRole('button', { name: 'Pick up at step 2', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page).toHaveURL(/\/guides$/)
  await expect(page.getByPlaceholder('Search guides')).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Pick up at step 2', exact: true })).toHaveCount(0)
})
