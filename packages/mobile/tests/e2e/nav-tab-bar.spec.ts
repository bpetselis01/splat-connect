import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createPublishedToy, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { addSteps } from './guides-fixtures'

// Option A (2026-10-06): the tab bar floats over every signed-in screen except
// chats and build mode, so a trail through guides ends in one tap on Home.

const tab = (page: import('@playwright/test').Page, name: string) => page.getByRole('tab', { name, exact: true })

test('the bar shows on a guide and on a screen pushed over the tabs', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Bar Guide'), status: 'approved' })

  await page.goto(`/guides/${id}`)
  await expect(tab(page, 'Home')).toBeVisible()

  await page.goto('/saved')
  await expect(tab(page, 'Me')).toBeVisible()
})

test('Home from a guide reached through Also worth a look lands on Home', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const pickTitle = uniqueTitle('E2E Bar Pick')
  const pickId = await createTutorial(contributor.id, { title: pickTitle, status: 'approved' })
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Bar Picker'), status: 'approved' })
  const { error } = await adminClient().from('tutorial_recommendations').insert({ tutorial_id: id, recommended_id: pickId, position: 1 })
  if (error) throw new Error(`Failed to seed recommendation: ${error.message}`)

  await page.goto('/home')
  await page.goto(`/guides/${id}`)
  await page.getByText(pickTitle).filter({ visible: true }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${pickId}$`))

  await tab(page, 'Home').click()
  await expect(page).toHaveURL(/\/home$/)
})

test('the bar is absent in build mode', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Bar Build'), status: 'approved' })
  await addSteps(id, [{ title: 'Open the bay', body: 'One screw.' }])

  await page.goto(`/guides/${id}`)
  await expect(tab(page, 'Home')).toBeVisible()
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start step 1', exact: true })).toBeVisible()
  await expect(tab(page, 'Home')).toHaveCount(0)
})

test('the bar is absent in an exchange thread', async ({ page }) => {
  const owner = await createContributor()
  const toyId = await createPublishedToy(owner.id, { name: uniqueTitle('E2E Bar Toy'), offer_type: 'donation' })
  await signInAsNewContributor(page)

  await page.goto(`/toy-library/${toyId}`)
  await page.getByRole('button', { name: 'Ask to collect it', exact: true }).click()
  await page.waitForURL(/\/exchanges\/[0-9a-f-]{36}/)
  await expect(tab(page, 'Home')).toHaveCount(0)
})
